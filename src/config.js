// One place for the things you may want to change.

// 1) LOGO. public/images/logo.svg is a PLACEHOLDER (your friend's frontend has the real one).
//    To use the real logo: replace public/images/logo.svg (same name) or point LOGO_SRC to another file, e.g. '/images/logo.png'.
//    LOGO_MARK_SRC is the small round icon used in tight spaces.
export const LOGO_SRC = '/images/logo.svg'
export const LOGO_MARK_SRC = '/images/logo-mark.svg'

// 2) PRODUCT IMAGES. The Excel sheet stores paths like  /products/Dairy/Milk/325.png
//    The admin tries these places, in this order, until one works:
//      a) image website + path   (Settings -> "Product images", or VITE_IMAGE_BASE_URL in .env)
//      b) /images + path         -> public/images/products/Dairy/Milk/325.png
//      c) path itself            -> public/products/Dairy/Milk/325.png
//    If none works, a neat coloured tile with a category icon is shown (name and stock still show).
export const IMAGE_BASE_URL = (import.meta.env.VITE_IMAGE_BASE_URL || '').trim().replace(/\/$/, '')

export const STORE_NAME = 'AssanMart'
