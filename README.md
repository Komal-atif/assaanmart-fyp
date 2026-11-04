# AssanMart Admin Portal
React + Vite + plain CSS. Built from your reference screens (login, splash, dashboard, products, orders).

    npm install
    npm run dev        ->  http://localhost:5173

First time: the login page asks you to create the admin account (name, email, password). After that it is a normal login.

## Your data
- `src/data/source/assanmart_dataset.xlsx` = your sheet (354 products). `npm run data` rebuilds `src/data/generated/products.json` (already done).
- Orders do not exist in your sheet, so **Demo data** (Settings) builds sample orders from your real products and prices, and fills empty stock cells with sample numbers. Real numbers from Excel (like the 18 zeros) are never changed. Switch it off in Settings -> Demo data.

## Product images
The sheet has paths like `/products/Dairy/Milk/325.png`. They are looked up in this order:
1. The image website, if set (Settings -> Product images, or `VITE_IMAGE_BASE_URL` in `.env`)
2. `public/images/products/Dairy/Milk/325.png`  (put your image folders inside `public/images/products/`)
3. `public/products/Dairy/Milk/325.png`

Run `npm run check-images` to list which files are found/missing. A picture that is not found shows a coloured category tile (name, price and stock still show).

## Logo
`public/images/logo.svg` and `logo-mark.svg` are PLACEHOLDERS. Replace those files with the real logo (same names), or change `LOGO_SRC` in `src/config.js`.

## Pages
Login, Welcome splash, Dashboard, Orders (+ details, CSV export, quick status menu), Products (grid/list, categories, + add stock), Inventory, Low Stock, Customers, Analytics, Settings. Dark mode: moon icon in the top bar.
