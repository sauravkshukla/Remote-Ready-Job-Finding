from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import requests
import PyPDF2
from io import BytesIO
from openai import OpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAI as LangChainOpenAI
from langchain.chains import RetrievalQA
from langchain.schema import Document
import json
import re
from datetime import datetime
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Resume Parser & Job Matcher API",
    description="Upload resumes and find matching remote jobs",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY environment variable is not set")
    print("Please set your OpenAI API key before running the application:")
    print("Windows: set OPENAI_API_KEY=your-api-key-here")
    print("Linux/Mac: export OPENAI_API_KEY='your-api-key-here'")
    print("The application will start but OpenAI features will be limited.")

# Pydantic models
class JobSearchRequest(BaseModel):
    skills: Optional[List[str]] = []
    technologies: Optional[List[str]] = []
    job_titles: Optional[List[str]] = []
    industries: Optional[List[str]] = []
    limit: Optional[int] = 20

class ResumeAnalysisRequest(BaseModel):
    text: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str

class JobInfo(BaseModel):
    position: str
    company: str
    salary: str
    location: str
    tags: List[str]
    apply_url: str
    date_posted: str
    description: str
    relevance_score: int
    matched_keywords: List[str]

class ResumeInfo(BaseModel):
    skills: List[str]
    experience: List[str]
    education: List[str]
    technologies: List[str]
    job_titles: List[str]
    industries: List[str]
    years_of_experience: str
    preferred_roles: List[str]

class ParseResumeResponse(BaseModel):
    success: bool
    resume_info: ResumeInfo
    jobs_found: int
    jobs: List[JobInfo]
    message: str

class ResumeParser:
    def __init__(self):
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not available. AI features will be limited.")
            self.embeddings = None
            self.llm = None
            self.openai_client = None
        else:
            self.embeddings = OpenAIEmbeddings(api_key=OPENAI_API_KEY)
            self.llm = LangChainOpenAI(temperature=0, api_key=OPENAI_API_KEY)
            self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        
    def extract_text_from_pdf(self, pdf_file: bytes) -> str:
        """Extract text from PDF file"""
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error extracting text from PDF: {str(e)}")
    
    def create_vector_store(self, text: str):
        """Create FAISS vector store from resume text"""
        try:
            if not self.embeddings:
                logger.warning("OpenAI embeddings not available. Skipping vector store creation.")
                return None
                
            # Split text into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )
            
            chunks = text_splitter.split_text(text)
            documents = [Document(page_content=chunk) for chunk in chunks]
            
            # Create vector store
            vector_store = FAISS.from_documents(documents, self.embeddings)
            return vector_store
        except Exception as e:
            logger.error(f"Error creating vector store: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating vector store: {str(e)}")
    
    def extract_resume_info(self, text: str) -> Dict[str, Any]:
        """Extract key information from resume using OpenAI"""
        try:
            if not self.openai_client:
                logger.warning("OpenAI API key not available. Using fallback parsing.")
                return self.fallback_resume_parsing(text)
            
            prompt = f"""
            Analyze the following resume text and extract key information in JSON format:
            
            Resume Text:
            {text}
            
            Please extract and return a JSON object with the following structure:
            {{
                "skills": ["skill1", "skill2", ...],
                "experience": ["job_title at company", ...],
                "education": ["degree from institution", ...],
                "technologies": ["tech1", "tech2", ...],
                "job_titles": ["title1", "title2", ...],
                "industries": ["industry1", "industry2", ...],
                "years_of_experience": "number",
                "preferred_roles": ["role1", "role2", ...]
            }}
            
            Focus on technical skills, programming languages, frameworks, tools, and relevant job titles.
            """
            
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert resume parser. Extract information accurately and return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0
            )
            
            result = response.choices[0].message.content
            
            # Clean and parse JSON
            result = result.strip()
            if result.startswith('```json'):
                result = result[7:-3]
            elif result.startswith('```'):
                result = result[3:-3]
            
            return json.loads(result)
            
        except Exception as e:
            logger.error(f"Error extracting resume info: {str(e)}")
            logger.info("Falling back to basic parsing...")
            return self.fallback_resume_parsing(text)
    
    def fallback_resume_parsing(self, text: str) -> Dict[str, Any]:
        """Fallback resume parsing without OpenAI"""
        try:
            # Basic keyword extraction
            text_lower = text.lower()
            
            # Common programming languages and technologies
            tech_keywords = [
                'python', 'javascript', 'java', 'react', 'node.js', 'sql', 'html', 'css',
                'mongodb', 'postgresql', 'mysql', 'docker', 'kubernetes', 'aws', 'azure',
                'git', 'linux', 'typescript', 'angular', 'vue', 'php', 'ruby', 'go',
                'c++', 'c#', '.net', 'spring', 'django', 'flask', 'express', 'laravel'
            ]
            
            # Extract technologies found in resume
            found_technologies = [tech for tech in tech_keywords if tech in text_lower]
            
            # Basic job titles extraction
            job_title_keywords = [
                'developer', 'engineer', 'programmer', 'analyst', 'manager', 'lead',
                'senior', 'junior', 'architect', 'consultant', 'specialist', 'coordinator'
            ]
            
            found_job_titles = [title for title in job_title_keywords if title in text_lower]
            
            return {
                "skills": found_technologies[:10],  # Limit results
                "experience": [],
                "education": [],
                "technologies": found_technologies,
                "job_titles": found_job_titles,
                "industries": [],
                "years_of_experience": "Not determined",
                "preferred_roles": found_job_titles
            }
            
        except Exception as e:
            logger.error(f"Error in fallback parsing: {str(e)}")
            return {
                "skills": [],
                "experience": [],
                "education": [],
                "technologies": [],
                "job_titles": [],
                "industries": [],
                "years_of_experience": "Not determined",
                "preferred_roles": []
            }
    
    def search_jobs_on_remoteok(self, resume_info: Dict[str, Any], limit: int = 20) -> List[Dict[str, Any]]:
        """Search for relevant jobs on RemoteOK based on resume information"""
        try:
            # Get job listings from RemoteOK API
            url = "https://remoteok.io/api"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code != 200:
                logger.error(f"Failed to fetch jobs from RemoteOK: {response.status_code}")
                return []
            
            jobs_data = response.json()
            
            # Filter out the first item (metadata)
            if jobs_data and isinstance(jobs_data[0], dict) and 'legal' in jobs_data[0]:
                jobs_data = jobs_data[1:]
            
            # Extract relevant keywords from resume
            keywords = []
            if 'skills' in resume_info:
                keywords.extend([skill.lower() for skill in resume_info['skills']])
            if 'technologies' in resume_info:
                keywords.extend([tech.lower() for tech in resume_info['technologies']])
            if 'job_titles' in resume_info:
                keywords.extend([title.lower() for title in resume_info['job_titles']])
            
            # Score and filter jobs
            relevant_jobs = []
            
            for job in jobs_data[:100]:  # Limit initial processing
                if not isinstance(job, dict):
                    continue
                    
                job_title = job.get('position', '').lower()
                job_description = job.get('description', '').lower()
                job_tags = [tag.lower() for tag in job.get('tags', [])]
                
                # Calculate relevance score
                score = 0
                matched_keywords = []
                
                for keyword in keywords[:20]:  # Limit keywords for performance
                    if keyword in job_title:
                        score += 3
                        matched_keywords.append(keyword)
                    elif keyword in job_tags:
                        score += 2
                        matched_keywords.append(keyword)
                    elif keyword in job_description:
                        score += 1
                        matched_keywords.append(keyword)
                
                if score > 0:
                    relevant_jobs.append({
                        'score': score,
                        'matched_keywords': list(set(matched_keywords)),
                        'job': job
                    })
            
            # Sort by relevance score and return top jobs
            relevant_jobs.sort(key=lambda x: x['score'], reverse=True)
            
            formatted_jobs = []
            for item in relevant_jobs[:limit]:
                job = item['job']
                formatted_job = {
                    'position': job.get('position', 'N/A'),
                    'company': job.get('company', 'N/A'),
                    'salary': self.format_salary(job.get('salary_min'), job.get('salary_max')),
                    'location': job.get('location', 'Remote'),
                    'tags': job.get('tags', []),
                    'apply_url': job.get('apply_url', f"https://remoteok.io/remote-jobs/{job.get('id', '')}"),
                    'date_posted': job.get('date', ''),
                    'description': job.get('description', '')[:500] + '...' if job.get('description', '') else 'N/A',
                    'relevance_score': item['score'],
                    'matched_keywords': item['matched_keywords']
                }
                formatted_jobs.append(formatted_job)
            
            return formatted_jobs
            
        except Exception as e:
            logger.error(f"Error searching jobs on RemoteOK: {str(e)}")
            return []
    
    def format_salary(self, min_salary, max_salary) -> str:
        """Format salary information"""
        if min_salary and max_salary:
            return f"${min_salary:,} - ${max_salary:,}"
        elif min_salary:
            return f"${min_salary:,}+"
        elif max_salary:
            return f"Up to ${max_salary:,}"
        else:
            return "Not specified"

# Initialize parser
resume_parser = ResumeParser()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy", 
        timestamp=datetime.now().isoformat()
    )

@app.post("/parse-resume")
async def parse_resume(
    resume: UploadFile = File(...),
    job_limit: int = Form(20)
):
    """Parse resume and find matching jobs"""
    try:
        # Check file type
        if not resume.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Read file content
        file_content = await resume.read()
        
        # Extract text from PDF
        logger.info("Extracting text from PDF...")
        text = resume_parser.extract_text_from_pdf(file_content)
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Create vector store for semantic search
        logger.info("Creating vector store...")
        vector_store = resume_parser.create_vector_store(text)
        
        # Extract resume information
        logger.info("Extracting resume information...")
        resume_info = resume_parser.extract_resume_info(text)
        
        # Search for relevant jobs
        logger.info("Searching for relevant jobs...")
        jobs = resume_parser.search_jobs_on_remoteok(resume_info, limit=job_limit)
        
        return {
            "success": True,
            "resume_info": resume_info,
            "jobs_found": len(jobs),
            "jobs": jobs,
            "message": f"Found {len(jobs)} relevant job opportunities"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in parse_resume: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/search-jobs")
async def search_jobs(request: JobSearchRequest):
    """Search jobs based on provided skills/criteria"""
    try:
        # Create mock resume info from provided data
        resume_info = {
            "skills": request.skills,
            "technologies": request.technologies,
            "job_titles": request.job_titles,
            "industries": request.industries
        }
        
        jobs = resume_parser.search_jobs_on_remoteok(resume_info, limit=request.limit)
        
        return {
            "success": True,
            "jobs_found": len(jobs),
            "jobs": jobs,
            "search_criteria": resume_info
        }
        
    except Exception as e:
        logger.error(f"Error in search_jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/analyze-resume-text")
async def analyze_resume_text(request: ResumeAnalysisRequest):
    """Analyze resume text directly (for testing)"""
    try:
        # Extract resume information
        resume_info = resume_parser.extract_resume_info(request.text)
        
        return {
            "success": True,
            "resume_info": resume_info
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_resume_text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Resume Parser & Job Matcher API",
        "version": "1.0.0",
        "endpoints": {
            "POST /parse-resume": "Upload PDF resume for parsing and job matching",
            "POST /search-jobs": "Search jobs based on skills/criteria",
            "POST /analyze-resume-text": "Analyze resume text directly",
            "GET /health": "Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    
    if not OPENAI_API_KEY:
        print("Warning: Running without OpenAI API key. Some features will be limited.")
    
    print("Starting Resume Parser & Job Matcher API...")
    print("Endpoints:")
    print("  POST /parse-resume - Upload PDF resume for parsing and job matching")
    print("  POST /search-jobs - Search jobs based on skills/criteria")
    print("  POST /analyze-resume-text - Analyze resume text directly")
    print("  GET /health - Health check")
    print("  GET /docs - Interactive API documentation")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)