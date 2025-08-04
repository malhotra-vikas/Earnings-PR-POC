import fitz  # PyMuPDF
from openai import OpenAI
import os
import json
import argparse

# Set your OpenAI API key
client = OpenAI()  # Automatically reads from OPENAI_API_KEY env var


# Heuristically extract heading candidates
def extract_headings_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    headings = []

    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    font_size = span["size"]
                    is_bold = "Bold" in span.get("font", "")
                    if len(text) > 4 and (font_size > 13 or is_bold):
                        headings.append(
                            {
                                "text": text,
                                "font_size": font_size,
                                "bold": is_bold,
                                "page": page_num,
                            }
                        )

    return headings


def extract_section_titles(pdf_path):
    doc = fitz.open(pdf_path)
    all_spans = []

    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    all_spans.append(
                        {
                            "text": text,
                            "font_size": span["size"],
                            "bold": "Bold" in span.get("font", ""),
                            "page": page_num,
                            "y": span["bbox"][1],  # vertical position
                        }
                    )

    # Sort by descending font size to identify headings
    sorted_spans = sorted(all_spans, key=lambda x: -x["font_size"])

    # Determine largest and next-largest sizes
    top_font_size = sorted_spans[0]["font_size"]
    section_font_cutoff = sorted(
        set(s["font_size"] for s in all_spans if s["bold"]), reverse=True
    )[
        1
    ]  # 2nd largest

    section_titles = []
    for span in sorted_spans:
        is_headline_area = span["page"] == 1 and span["y"] < 200
        if (
            span["bold"]
            and span["font_size"] >= section_font_cutoff - 0.5
            and not is_headline_area  # exclude top blurb
        ):
            section_titles.append(
                {
                    "title": span["text"],
                    "page": span["page"],
                    "font_size": span["font_size"],
                }
            )

    return section_titles


# Use OpenAI to clean and structure headings
def call_openai_with_headings(sections):
    # flat_text = "\n".join([h["text"] for h in headings])
    flat_text = "\n".join([s["title"] for s in sections])

    prompt = f"""
Below is a list of section titles and heading-like lines extracted from a company earnings PDF. 

Clean this list into proper sections:
- Group duplicates or partial headings
- Remove noise or broken lines
- For each section, return a title, a 1-2 sentence description of what the section is about and prompt for OpenAI.
- We will use the prompt to re-generate this section for a future news

Return an array of JSON objects in this format:
[
  {{
    "title": "Section title",
    "description": "Brief description of what this section typically covers"
    "prompt": "OpenAIO Prompt to re-generate this section for a future news"
  }},
  ...
]

Only include real section headings that were included in the {sections}. Do not make anything up.
If a section clearly resembles a topic or grouping include it even if it sounds regulatory or long.

Only include important business-related sections — do NOT include legal or template sections such as:
- Forward-Looking Statements
- About Company
- Investor Relations Contact

Focus on sections with financials, operations, strategy, commentary, or product updates.

=== START ===
{flat_text}
=== END ===
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a financial analyst parsing earnings reports.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content


# Main runner
def run(pdf_path):
    sections = extract_section_titles(pdf_path)
    print("Extracted sections without OpenAI ", json.dumps(sections, indent=2))

    # print(f"📄 Extracting headings from: {pdf_path}")
    # headings = extract_headings_from_pdf(pdf_path)
    # print(f"🧠 Found {len(headings)} heading candidates")

    # if not headings:
    #    print("❌ No headings found.")
    #    return

    print("🤖 Sending to OpenAI...")
    result = call_openai_with_headings(sections)

    result = result.strip()
    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    print("✅ OpenAI response:")
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    args = parser.parse_args()

    sections = extract_section_titles(args.pdf)
    result = call_openai_with_headings(sections)

    result = result.strip()
    if result.startswith("```json"):
        result = result.replace("```json", "").replace("```", "").strip()

    parsed = json.loads(result)
    print(json.dumps(parsed))  # 👈 This must be the only output


if __name__ == "__main__":
    main()
