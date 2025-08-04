import { type NextRequest, NextResponse } from "next/server"
import { writeFile, unlink } from "fs/promises"
import path, { join } from "path"
import { cwd } from "process"

import { spawn } from "child_process"
import { tmpdir } from "os"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const pdfFile = formData.get("pdf") as File
    if (!pdfFile) {
      return NextResponse.json({ error: "No PDF file uploaded" }, { status: 400 })
    }

    // Save file to temporary location
    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const tempPath = path.join(tmpdir(), `upload-${Date.now()}.pdf`)
    await writeFile(tempPath, buffer)

    // Spawn the Python process
    const pythonScriptPath = join(cwd(), "pythonPOC", "extract_sections.py")
    console.log("Running Python script at:", pythonScriptPath)

    const pythonProcess = spawn("python3", [pythonScriptPath, "--pdf", tempPath])

    let stdout = ""
    let stderr = ""

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    const exitCode: number = await new Promise((resolve) => {
      pythonProcess.on("close", resolve)
    })

    // Clean up temp file
    await unlink(tempPath)

    if (exitCode !== 0) {
      console.error("Python script failed:", stderr)
      return NextResponse.json({ error: "Python script failed", details: stderr }, { status: 500 })
    }
    
    console.log("⚠️ Raw stdout from Python:", stdout)

    const parsed = JSON.parse(stdout)
    return NextResponse.json({ sections: parsed })
  } catch (err) {
    console.error("Extract sections failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
