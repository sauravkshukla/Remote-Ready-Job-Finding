"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Search,
  FileText,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  Star,
  ExternalLink,
  Download,
  Share2,
  SortAsc,
  Moon,
  Sun,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"

// Types
interface Job {
  position: string
  company: string
  salary: string
  location: string
  tags: string[]
  apply_url: string
  date_posted: string
  description: string
  relevance_score: number
  matched_keywords: string[]
}

interface ResumeInfo {
  skills: string[]
  experience: string[]
  education: string[]
  technologies: string[]
  job_titles: string[]
  industries: string[]
  years_of_experience: number
  preferred_roles: string[]
}

interface SearchFilters {
  skills: string[]
  technologies: string[]
  job_titles: string[]
  industries: string[]
  limit: number
}

// Use environment variable for API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

// Utility function to strip HTML tags and decode HTML entities
const stripHtmlTags = (html: string): string => {
  if (!html) return ""

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, "")

  // Decode common HTML entities
  const htmlEntities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
    "&hellip;": "...",
    "&mdash;": "—",
    "&ndash;": "–",
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&rdquo;": '"',
    "&ldquo;": '"',
  }

  // Replace HTML entities
  Object.keys(htmlEntities).forEach((entity) => {
    text = text.replace(new RegExp(entity, "g"), htmlEntities[entity])
  })

  // Clean up extra whitespace
  text = text.replace(/\s+/g, " ").trim()

  return text
}

export default function ResumeJobMatcher() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState("upload")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobs, setJobs] = useState<Job[]>([])
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [jobLimit, setJobLimit] = useState([20])
  const [isDragOver, setIsDragOver] = useState(false)

  // Manual search states
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    skills: [],
    technologies: [],
    job_titles: [],
    industries: [],
    limit: 20,
  })
  const [currentInput, setCurrentInput] = useState("")
  const [currentInputType, setCurrentInputType] = useState<keyof SearchFilters>("skills")

  // Results states
  const [sortBy, setSortBy] = useState("relevance_score")
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set())

  // Health check on mount
  useEffect(() => {
    checkApiHealth()
  }, [])

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (!response.ok) {
        setError("API server is not responding. Please ensure the backend is running on http://localhost:8000")
      }
    } catch (err) {
      setError("Cannot connect to API server. Please ensure the backend is running on http://localhost:8000")
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload")
      return
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a PDF file only")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return
    }

    setIsLoading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append("resume", selectedFile)
      formData.append("job_limit", jobLimit[0].toString())

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(`${API_BASE_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        throw new Error("Failed to parse resume")
      }

      const data = await response.json()
      setJobs(data.jobs || [])
      setResumeInfo(data.resume_info || null)
      setSuccess("Resume parsed successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse resume")
    } finally {
      setIsLoading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  const handleManualSearch = async () => {
    if (
      searchFilters.skills.length === 0 &&
      searchFilters.technologies.length === 0 &&
      searchFilters.job_titles.length === 0 &&
      searchFilters.industries.length === 0
    ) {
      setError("Please add at least one search criteria")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/search-jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchFilters),
      })

      if (!response.ok) {
        throw new Error("Failed to search jobs")
      }

      const data = await response.json()
      setJobs(data.jobs || [])
      setSuccess("Job search completed!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search jobs")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }

  const addToSearchFilter = (type: keyof SearchFilters, value: string) => {
    if (
      value.trim() &&
      Array.isArray(searchFilters[type]) &&
      !(searchFilters[type] as string[]).includes(value.trim())
    ) {
      setSearchFilters((prev) => ({
        ...prev,
        [type]: [...(prev[type] as string[]), value.trim()],
      }))
    }
    setCurrentInput("")
  }

  const removeFromSearchFilter = (type: keyof SearchFilters, value: string) => {
    setSearchFilters((prev) => ({
      ...prev,
      [type]: (prev[type] as string[]).filter((item) => item !== value),
    }))
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    switch (sortBy) {
      case "relevance_score":
        return b.relevance_score - a.relevance_score
      case "date_posted":
        return new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime()
      case "salary":
        const aSalary = Number.parseInt(a.salary.replace(/[^0-9]/g, "")) || 0
        const bSalary = Number.parseInt(b.salary.replace(/[^0-9]/g, "")) || 0
        return bSalary - aSalary
      default:
        return 0
    }
  })

  const filteredJobs = sortedJobs.filter((job) => {
    if (filterTags.length === 0) return true
    return filterTags.some(
      (tag) =>
        job.tags.some((jobTag) => jobTag.toLowerCase().includes(tag.toLowerCase())) ||
        job.matched_keywords.some((keyword) => keyword.toLowerCase().includes(tag.toLowerCase())),
    )
  })

  const toggleJobExpansion = (index: number) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedJobs(newExpanded)
  }

  const handleExport = (type: 'csv') => {
    if (jobs.length === 0) return;

    // CSV Export
    const headers = ['Position', 'Company', 'Salary', 'Location', 'Date Posted', 'Relevance', 'Tags', 'Matched Keywords'];
    const rows = jobs.map(job => [
      job.position,
      job.company,
      job.salary,
      job.location,
      job.date_posted,
      Math.round(job.relevance_score * 100) + '%',
      job.tags.join('; '),
      job.matched_keywords.join('; ')
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(v => '"' + (v || '') + '"').join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jobs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 glass-effect rounded-xl">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Remote Ready</h1>
          </div>
          <button
            className="modern-button-outline text-white"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-float">
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-purple-400 mr-3" />
            <h2 className="heading-xl text-gradient-primary">
              UNLOCKING
              <br />
              CAREER OPPORTUNITIES
            </h2>
          </div>
          <p className="body-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Upload your resume or search manually to discover job opportunities that match your skills and experience
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 glass-effect border border-red-500/30 rounded-xl flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-200">{error}</span>
            <button onClick={() => setError(null)} title="Close error notification" className="ml-auto text-red-400 hover:text-red-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 glass-effect border border-green-500/30 rounded-xl flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-green-200">{success}</span>
            <button onClick={() => setSuccess(null)} title="Close success notification" className="ml-auto text-green-400 hover:text-green-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <div className="glass-effect p-2 rounded-2xl">
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="upload"
                  className="flex items-center space-x-2 text-white data-[state=active]:bg-white/20"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Resume</span>
                </TabsTrigger>
                <TabsTrigger
                  value="search"
                  className="flex items-center space-x-2 text-white data-[state=active]:bg-white/20"
                >
                  <Search className="h-4 w-4" />
                  <span>Manual Search</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Resume Upload Tab */}
          <TabsContent value="upload" className="space-y-8">
            <div className="tech-card max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="glass-effect p-4 rounded-2xl inline-block mb-6">
                  <FileText className="h-12 w-12 text-white" />
                </div>
                <h3 className="heading-lg text-white mb-4">UPLOAD YOUR RESUME</h3>
                <p className="body-md text-gray-300">
                  Upload your PDF resume to automatically extract skills and find matching jobs
                </p>
              </div>

              <div className="space-y-8">
                {/* File Upload Area */}
                <div
                  className={`glass-effect border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                    isDragOver ? "border-purple-400 bg-purple-500/10" : "border-white/20 hover:border-white/40"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                  <p className="heading-md text-white mb-2">
                    {selectedFile ? selectedFile.name : "Drag & drop your resume here"}
                  </p>
                  <p className="body-md text-gray-400 mb-6">or click to browse (PDF only, max 10MB)</p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="modern-button-outline text-white cursor-pointer inline-block"
                  >
                    Choose File
                  </label>
                </div>

                {/* Upload Progress */}
                {uploadProgress > 0 && (
                  <div className="glass-effect p-6 rounded-2xl space-y-3">
                    <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                      <div
                        className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-white text-center">Uploading... {uploadProgress}%</p>
                  </div>
                )}

                {/* Job Limit Slider */}
                <div className="glass-effect p-6 rounded-2xl space-y-4">
                  <Label className="body-md font-semibold text-white">Number of jobs to find: </Label>
                  <Slider value={jobLimit} onValueChange={setJobLimit} max={50} min={5} step={5} className="w-full" />
                  <span className="text-white">{jobLimit[0]}</span>
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isLoading}
                  className="w-full modern-button text-white flex items-center justify-center space-x-3 animate-glow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <span className="loader mr-2"></span> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" /> <span>Upload & Match Jobs</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Manual Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <div className="tech-card max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="glass-effect p-4 rounded-2xl inline-block mb-6">
                  <Search className="h-12 w-12 text-white" />
                </div>
                <h3 className="heading-lg text-white mb-4">MANUAL JOB SEARCH</h3>
                <p className="body-md text-gray-300">
                  Enter your skills, technologies, and preferences to find matching jobs
                </p>
              </div>

              <div className="space-y-6">
                {/* Search Filters */}
                {(["skills", "technologies", "job_titles", "industries"] as const).map((filterType) => (
                  <div key={filterType} className="space-y-3">
                    <Label className="body-md font-semibold text-white capitalize">
                      {filterType.replace("_", " ")}
                    </Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {searchFilters[filterType].map((item) => (
                        <span
                          key={item}
                          className="bg-purple-600 text-white px-3 py-1 rounded-full flex items-center space-x-2"
                        >
                          <span>{item}</span>
                          <button
                            type="button"
                            title={`Remove ${item}`}
                            onClick={() => removeFromSearchFilter(filterType, item)}
                            className="ml-1 text-white hover:text-gray-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentInputType === filterType ? currentInput : ""}
                        onChange={(e) => {
                          setCurrentInputType(filterType)
                          setCurrentInput(e.target.value)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && currentInput.trim()) {
                            addToSearchFilter(filterType, currentInput)
                          }
                        }}
                        placeholder={`Add ${filterType}`}
                        className="input bg-gray-800 text-white px-3 py-2 rounded-lg w-full"
                      />
                      <button
                        type="button"
                        onClick={() => addToSearchFilter(filterType, currentInput)}
                        disabled={!currentInput.trim() || currentInputType !== filterType}
                        className="modern-button-outline text-white px-4 py-2 rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}

                {/* Job Limit */}
                <div className="space-y-3">
                  <Label className="body-md font-semibold text-white">
                    Number of jobs to find: {searchFilters.limit}
                  </Label>
                  <Slider
                    value={[searchFilters.limit]}
                    onValueChange={(value) => setSearchFilters((prev) => ({ ...prev, limit: value[0] }))}
                    max={50}
                    min={5}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Search Button */}
                <button
                  onClick={handleManualSearch}
                  disabled={isLoading}
                  className="w-full modern-button text-white flex items-center justify-center space-x-3 animate-glow disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <span className="loader mr-2"></span> Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" /> <span>Search Jobs</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Results Section */}
        {(jobs.length > 0 || resumeInfo) && (
          <div className="mt-16 space-y-8">
            {/* Resume Analysis */}
            {resumeInfo && (
              <div className="tech-card">
                <div className="flex items-center mb-6">
                  <FileText className="h-6 w-6 text-white mr-3" />
                  <h3 className="heading-md text-white">RESUME ANALYSIS</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-300">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {resumeInfo.skills.map((skill) => (
                        <span key={skill} className="bg-purple-600 text-white px-3 py-1 rounded-full">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-300">Technologies</h4>
                    <div className="flex flex-wrap gap-2">
                      {resumeInfo.technologies.map((tech) => (
                        <span key={tech} className="bg-blue-600 text-white px-3 py-1 rounded-full">{tech}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-300">Experience</h4>
                    <p className="text-white">{resumeInfo.years_of_experience} years</p>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs Results */}
            {jobs.length > 0 && (
              <div className="space-y-8">
                {/* Results Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <h3 className="heading-lg text-white">FOUND {filteredJobs.length} JOBS</h3>

                  <div className="glass-effect rounded-xl">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-4 py-2 text-white bg-gray-800 rounded-xl border-none outline-none"
                      title="Sort jobs by"
                    >
                      <option value="relevance_score">Relevance</option>
                      <option value="date_posted">Date Posted</option>
                      <option value="salary">Salary</option>
                    </select>
                  </div>
                </div>

                {/* Job Cards */}
                <div className="grid gap-8">
                  {filteredJobs.map((job, index) => (
                    <div key={index} className={`tech-card hover:scale-[1.02] transition-all duration-300`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                          <span className="text-lg font-bold text-white">{job.position}</span>
                          <span className="text-purple-400 font-semibold">@ {job.company}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-green-400 font-semibold">{job.salary}</span>
                          <span className="text-blue-300">{job.location}</span>
                          <span className="text-gray-400 flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> {new Date(job.date_posted).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Star className="h-4 w-4" /> {Math.round(job.relevance_score * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {job.tags.map((tag) => (
                          <span key={tag} className="bg-gray-700 text-white px-2 py-1 rounded-full text-xs">{tag}</span>
                        ))}
                        {job.matched_keywords.map((kw) => (
                          <span key={kw} className="bg-pink-600 text-white px-2 py-1 rounded-full text-xs">{kw}</span>
                        ))}
                      </div>
                      <div className="mb-2">
                        <button
                          className="text-purple-400 underline text-sm"
                          onClick={() => toggleJobExpansion(index)}
                        >
                          {expandedJobs.has(index) ? "Hide Details" : "Show Details"}
                        </button>
                      </div>
                      {expandedJobs.has(index) && (
                        <div className="bg-gray-900/80 p-4 rounded-xl text-white mb-2">
                          {stripHtmlTags(job.description)}
                        </div>
                      )}
                      <div className="flex justify-end mt-2">
                        <a
                          href={job.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="modern-button-outline text-white flex items-center space-x-2"
                        >
                          <span>Apply</span>
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Export Options */}
                <div className="flex justify-center space-x-4 pt-8">
                  <button
                    className="modern-button-outline text-white flex items-center space-x-2"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="h-4 w-4" />
                    <span>Export to CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {jobs.length === 0 &&
          !isLoading &&
          (activeTab === "upload"
            ? selectedFile
            : Object.values(searchFilters).some((v) => (Array.isArray(v) ? v.length > 0 : false))) && (
            <div className="text-center py-16">
              <div className="glass-effect p-6 rounded-2xl inline-block mb-6">
                <Briefcase className="h-16 w-16 text-gray-400" />
              </div>
              <h3 className="heading-md text-white mb-4">NO JOBS FOUND</h3>
              <p className="body-md text-gray-400">Try adjusting your search criteria or upload a different resume</p>
            </div>
          )}
      </div>
    </div>
  )
}
