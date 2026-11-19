require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");
const Comment = require("./src/models/Comment");

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function clean(text) {
  return sanitizeHtml(String(text || ""), { allowedTags: [], allowedAttributes: {} }).trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function page(comments, note) {
  const items = comments.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("");
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Комментарий</title>
<style>body{font-family:system-ui;max-width:640px;margin:32px auto} li, .note{background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;margin:8px 0}</style>
</head><body>
<h1>Комментарий к статье</h1>
${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}
<form method="post" action="/api/comments">
<label for="text">Текст комментария</label><br>
<textarea id="text" name="text" rows="3"></textarea><br>
<button type="submit">Отправить</button>
</form>
<ul>${items}</ul>
</body></html>`;
}

app.get("/", async (req, res) => {
  const comments = await Comment.find().sort({ createdAt: 1 });
  res.type("html").send(page(comments));
});

app.post("/api/comments", async (req, res) => {
  try {
    const text = clean(req.body.text);
    const comments = await Comment.find().sort({ createdAt: 1 });
    if (!text) {
      return res
        .status(400)
        .type("html")
        .send(page(comments, "Опасная разметка удалена, комментарий не сохранён."));
    }
    await Comment.create({ text, articleSlug: "design-systems" });
    res.redirect("/");
  } catch (error) {
    res.status(400).json({ message: "Не удалось сохранить комментарий" });
  }
});

async function connect() {
  const uri = process.env.MONGO_URI;
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
      return;
    } catch (error) {
      console.log("Строка из .env недоступна, поднимаю встроенный MongoDB");
    }
  }
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri("blog"));
}

connect().then(() => {
  app.listen(process.env.PORT || 4010, () => console.log("secure api up"));
});
