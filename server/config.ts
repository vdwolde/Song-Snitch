// The one place the server reads its listening port. Read at import time, so it must
// come from the real shell environment (Start Song Snitch.bat, `npm run dev`), not
// from .env — see the note at the bottom of .env.
export const PORT = Number(process.env.PORT ?? 5178);
