import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const SectionSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().describe("The section title or heading"),
      description: z.string().describe("Brief description of what this section typically contains"),
    }),
  ),
})

// Helper function to extract text from PDF using browser APIs
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // For now, we'll use a simple text extraction approach
    // In a production environment, you might want to use a more robust PDF parser
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Convert to string (this is a simplified approach)
    let text = ""
    for (let i = 0; i < uint8Array.length; i++) {
      if (uint8Array[i] >= 32 && uint8Array[i] <= 126) {
        text += String.fromCharCode(uint8Array[i])
      } else if (uint8Array[i] === 10 || uint8Array[i] === 13) {
        text += " "
      }
    }

    // Clean up the text
    text = text.replace(/\s+/g, " ").trim()

    if (text.length < 100) {
      throw new Error("Could not extract meaningful text from PDF")
    }

    return text
  } catch (error) {
    console.error("PDF extraction error:", error)
    throw new Error("Failed to extract text from PDF")
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting section extraction...")

    const formData = await request.formData()
    const pdfFile = formData.get("pdf") as File

    if (!pdfFile) {
      console.error("No PDF file provided")
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    console.log("PDF file received:", pdfFile.name, "Size:", pdfFile.size)

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not found")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Extract text from PDF
    console.log("Extracting text from PDF...")
    let pdfText: string

    try {
      pdfText = await extractTextFromPDF(pdfFile)
      console.log("Text extracted, length:", pdfText.length)
    } catch (pdfError) {
      console.error("PDF processing failed:", pdfError)
      return NextResponse.json(
        {
          error: "Failed to process PDF file. Please ensure it's a valid PDF with extractable text.",
        },
        { status: 400 },
      )
    }

    // Limit text length to avoid token limits
    const maxLength = 10000
    if (pdfText.length > maxLength) {
      pdfText = pdfText.substring(0, maxLength)
      console.log("Text truncated to", maxLength, "characters")
    }

    console.log("Calling OpenAI API...")

    // Extract sections using OpenAI with AI SDK v5
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"), // Using gpt-4o-mini which is supported in AI SDK v5
      schema: SectionSchema,
      prompt: `
        Analyze this earnings press release text and extract the main section titles/headings that would serve as a template structure for other earnings press releases.

        Focus on identifying:
        1. Major section headings (like "Financial Highlights", "Business Overview", "Outlook", etc.)
        2. Standard earnings press release sections
        3. Key structural elements that are commonly found in earnings announcements

        Provide a brief description for each section explaining what type of content it typically contains.

        If the text appears to be corrupted or unclear, please extract common earnings press release sections based on standard practices.

        Press Release Text:
        ${pdfText}
      `,
    })

    console.log("Sections extracted:", object.sections.length)
    return NextResponse.json({ sections: object.sections })
  } catch (error) {
    console.error("Error in extract-sections API:", error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json({ error: "OpenAI API configuration error" }, { status: 500 })
      }
      if (error.message.includes("model")) {
        return NextResponse.json({ error: "AI model error. Please try again." }, { status: 500 })
      }
    }

    return NextResponse.json(
      {
        error: "Failed to extract sections. Please try again or contact support.",
      },
      { status: 500 },
    )
  }
}
