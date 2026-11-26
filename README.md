# BlueStore - Sales & Inventory Dashboard

Open `index.html` (store) or `admin.html` (admin panel). Keep all files in one folder.
For GitHub Pages: upload the whole folder to the repository root and enable Pages.

- `data.js` original dataset (unchanged)
- `shared.js` data helpers, localStorage orders
- `art.js` + `images.js` product visuals (photo in `images/<slug>.jpg` if listed in `images.js`, else generated SVG)
- `store.js` storefront, cart, checkout, tracking
- `admin.js` charts, insights, price bands, tables
- `image-prompts.txt` prompts to generate the missing product images

Orders placed in the store are saved in this browser (localStorage) only. A shared database needs a backend (e.g. Firebase/Firestore or Supabase).
