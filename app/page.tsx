"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, Sparkles, Download } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SectionTitle {
  title: string
  description: string
}

export default function EarningsPressReleaseGenerator() {
  const [step, setStep] = useState(1)
  const [samplePdfFile, setSamplePdfFile] = useState<File | null>(null)
  const [tenQFile, setTenQFile] = useState<File | null>(null)
  const [extractedSections, setExtractedSections] = useState<SectionTitle[]>([])
  const [generatedPressRelease, setGeneratedPressRelease] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  const handleSamplePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setSamplePdfFile(file)
      setError("")
    } else {
      setError("Please upload a valid PDF file")
    }
  }

  const handleTenQUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTenQFile(file)
      setError("")
    }
  }

  const extractSectionTitles = async () => {
    if (!samplePdfFile) return

    setIsProcessing(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("pdf", samplePdfFile)

      const response = await fetch("/api/extract-sections", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to extract sections")
      }

      const data = await response.json()
      setExtractedSections(data.sections)
      setStep(2)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      console.error("Section extraction error:", errorMessage)

      if (errorMessage.includes("API key")) {
        setError("OpenAI API key not configured. Please check your environment variables.")
      } else if (errorMessage.includes("PDF")) {
        setError("Could not process the PDF file. Please ensure it's a valid PDF with readable text.")
      } else {
        setError("Error extracting sections from PDF. Please try again with a different file.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const generatePressRelease = async () => {
    if (!tenQFile || extractedSections.length === 0) return

    setIsProcessing(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("tenq", tenQFile)
      formData.append("sections", JSON.stringify(extractedSections))

      const response = await fetch("/api/generate-press-release", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to generate press release")
      }

      const data = await response.json()
      setGeneratedPressRelease(data.pressRelease)
      setStep(3)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      console.error("Press release generation error:", errorMessage)

      if (errorMessage.includes("API key")) {
        setError("OpenAI API key not configured. Please check your environment variables.")
      } else if (errorMessage.includes("file")) {
        setError("Could not process the 10-Q file. Please ensure it's a valid document.")
      } else {
        setError("Error generating press release. Please try again.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadPressRelease = () => {
    const blob = new Blob([generatedPressRelease], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "generated-press-release.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetProcess = () => {
    setStep(1)
    setSamplePdfFile(null)
    setTenQFile(null)
    setExtractedSections([])
    setGeneratedPressRelease("")
    setError("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AiirHub - POC for Earnings Press Release Generator</h1>
          <p className="text-lg text-gray-600">
            Extract section templates from sample press releases and generate new ones from 10-Q filings
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload Sample Press Release */}
        {step >= 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                Upload Sample Press Release PDF
              </CardTitle>
              <CardDescription>
                Upload a sample earnings press release PDF to extract section titles and structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sample-pdf">Sample Press Release PDF</Label>
                  <Input id="sample-pdf" type="file" accept=".pdf" onChange={handleSamplePdfUpload} className="mt-1" />
                </div>
                {samplePdfFile && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4" />
                    {samplePdfFile.name}
                  </div>
                )}
                <Button onClick={extractSectionTitles} disabled={!samplePdfFile || isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Extracting Sections...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Extract Section Titles
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Show Extracted Sections and Upload 10-Q */}
        {step >= 2 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                Extracted Sections & Upload 10-Q
              </CardTitle>
              <CardDescription>
                Review extracted sections and upload your 10-Q filing to generate the new press release
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Extracted Section Titles:</h3>
                  <div className="grid gap-2">
                    {extractedSections.map((section, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Badge variant="secondary">{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{section.title}</div>
                          <div className="text-sm text-gray-600">{section.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="tenq-file">10-Q Filing Document</Label>
                  <Input
                    id="tenq-file"
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleTenQUpload}
                    className="mt-1"
                  />
                  {tenQFile && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                      <FileText className="w-4 h-4" />
                      {tenQFile.name}
                    </div>
                  )}
                </div>

                <Button onClick={generatePressRelease} disabled={!tenQFile || isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Generating Press Release...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Press Release
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Show Generated Press Release */}
        {step >= 3 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                Generated Press Release
              </CardTitle>
              <CardDescription>
                Your new earnings press release based on the 10-Q filing and extracted template structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  value={generatedPressRelease}
                  onChange={(e) => setGeneratedPressRelease(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Generated press release will appear here..."
                />
                <div className="flex gap-2">
                  <Button onClick={downloadPressRelease} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download Press Release
                  </Button>
                  <Button onClick={resetProcess} variant="outline" className="flex-1 bg-transparent">
                    Start Over
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
