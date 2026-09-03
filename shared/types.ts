// Types shared between server and client. Keep this file dependency-free (no imports
// from server/ or src/) so both sides can import it without pulling in the other's code.

export interface Item {
  id: number;
  label: string;
  createdAt: string;
}
