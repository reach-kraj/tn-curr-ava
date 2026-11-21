/**
 * Tamil Nadu public holidays and major travel festivals.
 *
 * 2027: Government of Tamil Nadu, G.O.(Ms.) No.613, Public (Miscellaneous) Department, dated 06.10.2026
 *       (annexure "Public Holidays" under the Negotiable Instruments Act, 1881). The bank-only
 *       "Annual closing of accounts" (01.04.2027) is left out. The same order closes all state
 *       government offices on every Saturday and Sunday of 2027.
 * 2026: Christmas (25 Dec), the one public holiday left in 2026.
 * "festival" entries are big travel days that are not public holidays (e.g. Bhogi, the day before Pongal).
 * Islamic dates are subject to moon sighting, as the order notes.
 */
export interface Holiday { date: string; name: string; kind: "public" | "festival"; note?: string }

export const HOLIDAY_SOURCE = "Tamil Nadu G.O.(Ms.) No.613, Public (Misc.) Dept., 06.10.2026";

export const HOLIDAYS: Holiday[] = [
  { date: "2026-12-25", name: "Christmas", kind: "public" },
  { date: "2027-01-01", name: "New Year's Day", kind: "public" },
  { date: "2027-01-14", name: "Bhogi", kind: "festival", note: "Day before Pongal; heavy travel" },
  { date: "2027-01-15", name: "Pongal", kind: "public" },
  { date: "2027-01-16", name: "Thiruvalluvar Day", kind: "public" },
  { date: "2027-01-17", name: "Uzhavar Thirunal", kind: "public" },
  { date: "2027-01-22", name: "Thai Poosam", kind: "public" },
  { date: "2027-01-26", name: "Republic Day", kind: "public" },
  { date: "2027-03-10", name: "Ramzan (Idu'l Fitr)", kind: "public", note: "Subject to moon sighting" },
  { date: "2027-03-26", name: "Good Friday", kind: "public" },
  { date: "2027-04-07", name: "Telugu New Year's Day", kind: "public" },
  { date: "2027-04-14", name: "Tamil New Year's Day / Dr. B.R. Ambedkar's Birthday", kind: "public" },
  { date: "2027-04-19", name: "Mahaveer Jayanthi", kind: "public" },
  { date: "2027-05-01", name: "May Day", kind: "public" },
  { date: "2027-05-17", name: "Bakrid (Idul Zuha)", kind: "public", note: "Subject to moon sighting" },
  { date: "2027-06-15", name: "Muharram", kind: "public", note: "Subject to moon sighting" },
  { date: "2027-08-15", name: "Independence Day / Milad-un-Nabi", kind: "public" },
  { date: "2027-08-25", name: "Krishna Jayanthi", kind: "public" },
  { date: "2027-09-04", name: "Vinayakar Chathurthi", kind: "public" },
  { date: "2027-10-02", name: "Gandhi Jayanthi", kind: "public" },
  { date: "2027-10-08", name: "Ayutha Pooja", kind: "public" },
  { date: "2027-10-09", name: "Vijaya Dasami", kind: "public" },
  { date: "2027-10-28", name: "Deepavali", kind: "public" },
  { date: "2027-12-25", name: "Christmas", kind: "public" },
];
