import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

interface SectionTitle {
  title: string
  description: string
}

// Helper function to extract text from various file types
async function extractTextFromFile(file: File): Promise<string> {
  try {
    if (file.type === "application/pdf") {
      // Simple PDF text extraction
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      let text = ""
      for (let i = 0; i < uint8Array.length; i++) {
        if (uint8Array[i] >= 32 && uint8Array[i] <= 126) {
          text += String.fromCharCode(uint8Array[i])
        } else if (uint8Array[i] === 10 || uint8Array[i] === 13) {
          text += " "
        }
      }

      return text.replace(/\s+/g, " ").trim()
    } else {
      // Handle text files
      return await file.text()
    }
  } catch (error) {
    console.error("File extraction error:", error)
    throw new Error("Failed to extract text from file")
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting press release generation...")

    const formData = await request.formData()
    const tenQFile = formData.get("tenq") as File
    const sectionsJson = formData.get("sections") as string

    if (!tenQFile || !sectionsJson) {
      console.error("Missing required data")
      return NextResponse.json({ error: "Missing 10-Q file or sections data" }, { status: 400 })
    }

    console.log("10-Q file received:", tenQFile.name, "Size:", tenQFile.size)

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not found")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const sections: SectionTitle[] = JSON.parse(sectionsJson)
    console.log("Sections to use:", sections.length)

    // Extract text from 10-Q document
    console.log("Extracting text from 10-Q file...")
    let tenQText: string

    try {
      tenQText = await extractTextFromFile(tenQFile)
      console.log("10-Q text extracted, length:", tenQText.length)
    } catch (fileError) {
      console.error("File processing failed:", fileError)
      return NextResponse.json(
        {
          error: "Failed to process 10-Q file. Please ensure it's a valid document.",
        },
        { status: 400 },
      )
    }

    // Limit text length to avoid token limits
    const maxLength = 15000
    if (tenQText.length > maxLength) {
      tenQText = tenQText.substring(0, maxLength)
      console.log("10-Q text truncated to", maxLength, "characters")
    }

    console.log("Calling OpenAI API for press release generation...")

    // Generate the press release using AI SDK v5
    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // Using gpt-4o-mini which is supported in AI SDK v5
      prompt: `
        You are an expert financial communications writer. Create a professional earnings press release based on the provided 10-Q filing data, following the structure and sections from the template.

        TEMPLATE STRUCTURE TO FOLLOW:
        ${sections.map((section, index) => `${index + 1}. ${section.title}: ${section.description}`).join("\n")}

        INSTRUCTIONS:
        1. Create a compelling headline and subheadline
        2. Follow the template structure provided above
        3. Extract relevant financial data, metrics, and key information from the 10-Q filing
        4. Write in a professional, clear, and engaging tone typical of earnings press releases
        5. Include specific numbers, percentages, and financial metrics where available
        6. Ensure each section provides meaningful content based on the 10-Q data
        7. Add appropriate forward-looking statements and disclaimers where needed
        8. Make sure the press release flows logically and tells a coherent story about the company's performance

        10-Q FILING DATA:
        ${tenQText}

        Generate a complete, professional earnings press release following the template structure.
      `,
    })

    console.log("Press release generated successfully")
    return NextResponse.json({ pressRelease: text })
  } catch (error) {
    console.error("Error in generate-press-release API:", error)

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
        error: "Failed to generate press release. Please try again or contact support.",
      },
      { status: 500 },
    )
  }
}
