# angel-tree-db-exporter-web

永恒族谱 v3.4 - v3.6 以及 v5.0 以上版本的数据导出器。你可以拖拽一个 Original.Lgd 族谱文件到网页上，然后服务器会自动处理数据库的导出供你下载。因为 MS Access 的数据库连接器无法在网页里运行，所以不得不在服务器处理。但是我们服务器不会存储你的任何输入数据，这个放心。

A static frontend for decrypting Angel Tree (永恒族谱) `Original.Lgd` databases. The
heavy lifting (reading the password-protected MS Access file and decrypting each column)
runs in the companion backend Worker.

## Flow

1. **Pick the version.** `v3.x` enables the admin name + password (the password /
   通行证密码 is the decryption key). `v5.x` needs no login, so those boxes are shown but
   disabled.
2. **Drop or select** an `Original.Lgd` file.
3. **Upload** — the server stores it under a random UUID and returns that UUID.
4. **Decrypt** — the server starts decoding in the background.
5. The page **polls status every 10 seconds** and, when done, shows a preview plus
   download links for the `.txt` and `.json` output.

## Configure

Edit `config.js` and point it at your deployed Worker:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://db-server.jiapu.au", // production Worker (default)
  POLL_INTERVAL_MS: 10000,
};
```

`config.js` ships pointing at the production Worker (`https://db-server.jiapu.au`). For
local development, run the Worker with `npm run dev` and set `API_BASE_URL` to
`http://localhost:8787`.

## Run locally

No build step — it's plain HTML/CSS/JS. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open the printed URL. Make sure the Worker's `ALLOWED_ORIGINS` permits this origin
(the default `*` allows any).

## Deploy

Any static host works. With Cloudflare Pages:

```bash
npx wrangler pages deploy .
```

## Files

```
index.html   markup: version selector, conditional credentials, dropzone, actions
styles.css   styling
app.js        upload / decrypt / 10s status polling / result preview + download
config.js     API base URL + poll interval
```
