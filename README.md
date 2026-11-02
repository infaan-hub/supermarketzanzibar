# supermarketzanzibar

## Product barcodes (Code 128)

The POS accepts Code 128 labels for primary product barcodes and for pack
sizes (for example a carton of 12). Scanned values are resolved by
`GET /api/barcodes/lookup?barcode=...`, which returns the product, packaging
unit, current branch price and stock. Checkout always re-prices from the
database.

Apply the barcode migration once (it creates
`supermarketzanzibar_productbarcode` and backfills every existing
`Product.barcode` as a primary label):

```bash
npx prisma migrate deploy
```

Useful endpoints:

- `GET /api/barcodes/lookup?barcode=ZN-10001` — resolve a scan.
- `GET /api/barcodes/label?value=ZN-10001` — printable Code 128 SVG label.
- `GET /api/barcodes?productId=1` — list a product's labels.
- `POST /api/barcodes` — attach a pack/shelf label (admin bearer token).
