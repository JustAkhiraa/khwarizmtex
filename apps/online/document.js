// Sous-ensemble volontairement explicite : titres, paragraphes, listes et maths.
// Aucune interprétation de HTML, aucun moteur Markdown externe.
export function parseDocument(source) {
  const blocks = [];
  const diagnostics = [];
  const lines = source.split("\n");
  let offset = 0;
  let math = null;
  let paragraph = null;
  const flush = () => {
    if (paragraph) blocks.push(paragraph);
    paragraph = null;
  };
  for (const line of lines) {
    if (line.trim() === "$$") {
      flush();
      if (math) {
        math.text = math.text.replace(/\n$/, "");
        blocks.push(math);
        math = null;
      } else
        math = {
          type: "math",
          text: "",
          start: offset + line.length + 1,
          opening: offset,
        };
    } else if (math) math.text += line + "\n";
    else if (!line.trim()) flush();
    else {
      const heading = /^(#{1,3}) (.+)$/.exec(line);
      const item = /^- (.+)$/.exec(line);
      if (heading || item) {
        flush();
        blocks.push({
          type: heading ? "heading" : "item",
          level: heading ? heading[1].length : 0,
          text: heading ? heading[2] : item[1],
          start: offset + (heading ? heading[1].length + 1 : 2),
        });
      } else if (paragraph) paragraph.text += "\n" + line;
      else paragraph = { type: "paragraph", text: line, start: offset };
    }
    offset += line.length + 1;
  }
  flush();
  if (math) {
    blocks.push({
      type: "paragraph",
      text: "$$\n" + math.text,
      start: math.opening,
    });
    diagnostics.push({
      message: "Fermez cette équation avec $$ sur une ligne séparée.",
      start: math.opening,
      end: source.length,
    });
  }
  return { blocks, diagnostics };
}
function escaped(text, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}
export function inlineParts(text) {
  const parts = [];
  let cursor = 0;
  let opening = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "$" || escaped(text, i)) continue;
    if (opening < 0) opening = i;
    else {
      if (opening > cursor)
        parts.push({
          type: "text",
          text: text.slice(cursor, opening),
          start: cursor,
        });
      parts.push({
        type: "math",
        text: text.slice(opening + 1, i),
        start: opening + 1,
      });
      cursor = i + 1;
      opening = -1;
    }
  }
  if (cursor < text.length)
    parts.push({ type: "text", text: text.slice(cursor), start: cursor });
  return parts;
}
export function renderDocument(source, title, target, engine) {
  const parsed = parseDocument(source);
  const displays = parsed.blocks.filter((b) => b.type === "math");
  if (displays.length > 150)
    throw new Error("Limite de 150 équations centrées par document.");
  const options = {
    displayMode: true,
    maxLength: 6000,
    maxExpand: 500,
    maxDepth: 64,
  };
  const batch = engine.renderAllToNodes(
    displays.map((b) => b.text),
    target.ownerDocument,
    options,
  );
  const errors = [...parsed.diagnostics];
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("h1");
  heading.textContent = title || "Document sans titre";
  fragment.append(heading);
  let displayIndex = 0;
  let inlineCount = 0;
  let list = null;
  for (const block of parsed.blocks) {
    if (block.type === "math") {
      list = null;
      const wrap = document.createElement("div");
      wrap.className = "equation-block";
      wrap.append(batch.nodes[displayIndex]);
      for (const error of batch.errors[displayIndex])
        errors.push({
          ...error,
          start: block.start + error.start,
          end: block.start + error.end,
        });
      displayIndex++;
      fragment.append(wrap);
      continue;
    }
    const element = document.createElement(
      block.type === "heading"
        ? "h" + Math.min(3, block.level + 1)
        : block.type === "item"
          ? "li"
          : "p",
    );
    for (const part of inlineParts(block.text)) {
      if (part.type === "text") {
        element.append(
          document.createTextNode(part.text.replace(/\\\$/g, "$")),
        );
        continue;
      }
      if (++inlineCount > 300)
        throw new Error("Limite de 300 formules dans le texte par document.");
      const inlineOptions = {
        ...options,
        displayMode: false,
        references: batch.references,
      };
      const wrap = document.createElement("span");
      wrap.className = "inline-math";
      wrap.append(engine.renderToNode(part.text, document, inlineOptions));
      element.append(wrap);
      for (const error of engine.parse(part.text, inlineOptions).errors) {
        errors.push({
          ...error,
          start: block.start + part.start + error.start,
          end: block.start + part.start + error.end,
        });
      }
    }
    if (block.type === "item") {
      if (!list) {
        list = document.createElement("ul");
        fragment.append(list);
      }
      list.append(element);
    } else {
      list = null;
      fragment.append(element);
    }
  }
  target.replaceChildren(fragment);
  return { errors, count: displays.length + inlineCount };
}
