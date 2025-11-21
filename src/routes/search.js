import axios from "axios";

export default async function search(req, res) {
  const q = req.query.q;

  const booksRes = await axios.get(
    `https://openlibrary.org/search.json?q=${q}`,
  );
  const authorsRes = await axios.get(
    `https://openlibrary.org/search/authors.json?q=${q}`,
  );

  const docs = booksRes.data.docs || [];
  const books = docs
    .map((doc) => {
      const id =
        doc.cover_edition_key ||
        (doc.key ? doc.key.replace("/works/", "") : null);

      if (!id) return null;

      return {
        title: doc.title,
        author_name: doc.author_name || null,
        author_id: doc.author_key || null,
        id,
        first_publish_year: doc.first_publish_year || null,
        cover: doc.cover_i || null,
      };
    })
    .filter(Boolean);

  const authors = (authorsRes.data.docs || []).map((doc) => ({
    name: doc.name,
    work_count: doc.work_count || null,
    author_id: doc.key || null,
    alt_names: doc.alternate_names || null,
  }));

  res.json({ books, authors });
}
