import axios from "axios";

export default async function getBook(req, res) {
  const { id } = req.params;

  const isEdition = id.startsWith("OL") && id.endsWith("M");

  if (isEdition) {
    const data = await getFromEdition(id);
    return res.json(data);
  } else {
    const data = await getFromWork(id);
    return res.json(data);
  }
}

async function getFromEdition(id) {
  const edition = await axios.get(`https://openlibrary.org/books/${id}.json`);
  const e = edition.data;

  const workEntry = e.works?.[0]?.key;
  let description = null;
  let authors = [];

  if (workEntry) {
    const workId = workEntry.replace("/works/", "");
    const details = await fetchWorkDetails(workId);
    description = details.description;
    authors = details.authors;
  }

  const cover = e.covers?.find((c) => typeof c === "number" && c >= 0) || null;

  return {
    title: e.title || "Untitled",
    description,
    authors,
    edition_key: id,
    publish_date: e.publish_date || null,
    number_of_pages: e.number_of_pages || null,
    cover,
  };
}

async function getFromWork(id) {
  const work = await axios.get(`https://openlibrary.org/works/${id}.json`);
  const w = work.data;

  const description =
    typeof w.description === "string"
      ? w.description
      : w.description?.value || null;

  const authors = [];

  if (Array.isArray(w.authors)) {
    for (const entry of w.authors) {
      const key = entry.author?.key;
      if (!key) continue;

      const authorId = key.replace("/authors/", "");
      const author = await axios.get(
        `https://openlibrary.org/authors/${authorId}.json`,
      );

      const name = author.data.name;
      if (name) {
        authors.push({ name, key: authorId });
      }
    }
  }

  const cover = w.covers?.find((c) => typeof c === "number" && c >= 0) || null;

  return {
    title: w.title || "Untitled",
    description,
    authors,
    edition_key: null,
    publish_date: null,
    number_of_pages: null,
    cover,
  };
}

async function fetchWorkDetails(id) {
  try {
    const work = await axios.get(`https://openlibrary.org/works/${id}.json`);
    const w = work.data;

    const description =
      typeof w.description === "string"
        ? w.description
        : w.description?.value || null;

    const authors = [];
    if (Array.isArray(w.authors)) {
      for (const entry of w.authors) {
        const key = entry.author?.key;
        if (!key) continue;

        const authorId = key.replace("/authors/", "");
        const author = await axios.get(
          `https://openlibrary.org/authors/${authorId}.json`,
        );

        const name = author.data.name;
        if (name) {
          authors.push({ name, key: authorId });
        }
      }
    }

    return { description, authors };
  } catch {
    return { description: null, authors: [] };
  }
}
