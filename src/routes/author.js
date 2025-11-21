import axios from "axios";

export default async function getAuthor(req, res) {
  const { id } = req.params;

  const authorRes = await axios.get(
    `https://openlibrary.org/authors/${id}.json`,
  );
  const a = authorRes.data;

  const name = a.name || "Unknown";

  let bio = null;
  if (typeof a.bio === "string") bio = a.bio;
  else if (a.bio?.value) bio = a.bio.value;

  const alternate_names = a.alternate_names || null;

  const birth = a.birth_date;
  const death = a.death_date;
  const date = a.date;

  function extractYear(s) {
    const match = s?.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }

  let lifespan = null;
  if (date) {
    lifespan = date;
  } else {
    const b = extractYear(birth);
    const d = extractYear(death);
    if (b && d) lifespan = `${b}-${d}`;
    else if (b) lifespan = `${b}-?`;
    else if (d) lifespan = `?- ${d}`;
  }

  const worksRes = await axios.get(
    `https://openlibrary.org/authors/${id}/works.json`,
  );

  const works = (worksRes.data.entries || []).map((entry) => ({
    work_id: entry.key.replace("/works/", ""),
    title: entry.title,
  }));

  res.json({
    name,
    bio,
    alternate_names,
    works,
    lifespan,
  });
}
