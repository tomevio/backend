import jwt from "jsonwebtoken";

export function loginHandler(req, res) {
  const { username, passwd } = req.body;

  const isValid = username === "admin" && passwd === "password";
  if (!isValid) return res.status(401).end();

  const token = jwt.sign({ sub: username }, "secret_key", { expiresIn: "24h" });

  res.json({ token });
}

export function getInfoHandler(req, res) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).end();

  const token = auth.replace("Bearer ", "");

  try {
    jwt.verify(token, "secret_key");
    res.json("You are valid");
  } catch {
    res.status(401).end();
  }
}
