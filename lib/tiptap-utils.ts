export function tiptapToHtml(content: string): string {
  if (!content) return ""

  try {
    // If content is already HTML string, return it
    if (typeof content === "string" && content.trim().startsWith("<")) {
      return content
    }

    // If content is JSON string, parse and convert
    const json = typeof content === "string" ? JSON.parse(content) : content

    // Simple Tiptap JSON to HTML converter
    const convertNode = (node: any): string => {
      if (!node) return ""

      if (node.type === "text") {
        let text = node.text || ""
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            switch (mark.type) {
              case "bold":
                text = `<strong>${text}</strong>`
                break
              case "italic":
                text = `<em>${text}</em>`
                break
              case "code":
                text = `<code>${text}</code>`
                break
              case "link":
                text = `<a href="${mark.attrs?.href || "#"}" target="_blank" rel="noopener noreferrer">${text}</a>`
                break
            }
          })
        }
        return text
      }

      const content = node.content?.map(convertNode).join("") || ""

      switch (node.type) {
        case "doc":
          return content
        case "paragraph":
          return `<p>${content}</p>`
        case "heading":
          const level = node.attrs?.level || 1
          return `<h${level}>${content}</h${level}>`
        case "bulletList":
          return `<ul>${content}</ul>`
        case "orderedList":
          return `<ol>${content}</ol>`
        case "listItem":
          return `<li>${content}</li>`
        case "codeBlock":
          return `<pre><code>${content}</code></pre>`
        case "blockquote":
          return `<blockquote>${content}</blockquote>`
        case "hardBreak":
          return "<br>"
        case "horizontalRule":
          return "<hr>"
        default:
          return content
      }
    }

    return convertNode(json)
  } catch (error) {
    console.error("Error converting Tiptap to HTML:", error)
    return content
  }
}
