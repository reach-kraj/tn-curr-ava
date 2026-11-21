/**
 * Frequently asked questions. Rendered as HTML on the page and as FAQPage structured data,
 * so answers are readable by people, search engines and AI assistants alike.
 * Keep answers short, direct and accurate.
 */
export interface Faq { q: string; a: string }

export const FAQS: Faq[] = [
  {
    q: "What is current availability on Indian Railways?",
    a: "Current availability is the set of seats and berths still free after the reservation chart is prepared. You can book them online until shortly before the train leaves your boarding station, at the normal fare.",
  },
  {
    q: "When does current availability open for a train?",
    a: "It opens when the train's first reservation chart is prepared, which is counted from when the train leaves its first (source) station, not your station. This app uses 10 hours before source departure by default, and you can switch to the 8-hour or 4-hour rule. Always confirm on IRCTC.",
  },
  {
    q: "Why does a train I board after midnight open a day earlier?",
    a: "Booking always follows the day the train starts its journey. For example, 16104 leaves Rameswaram at 4:00 PM on Saturday and reaches Villupuram at 1:10 AM on Sunday, so its current availability opens on Saturday morning.",
  },
  {
    q: "How many days in advance can I book a train ticket?",
    a: "Advance reservation opens 60 days before the date of journey, not counting the journey date itself, at 8:00 AM IST. The journey date is the day the train leaves its source station. A few daytime trains use a shorter window.",
  },
  {
    q: "When does Tatkal booking open?",
    a: "Tatkal opens one day before the journey date (counted from the source station): 10:00 AM IST for AC classes and 11:00 AM IST for non-AC classes.",
  },
  {
    q: "Which Tamil Nadu holidays and long weekends are covered?",
    a: "All Tamil Nadu public holidays for 2027 from the state government order G.O.(Ms.) No.613 dated 06.10.2026, plus Christmas 2026. Holidays next to a weekend are grouped into long weekends, with the day to travel out, the day to come back and when booking opens for each.",
  },
  {
    q: "Are these train times live?",
    a: "No. Times come from the scheduled timetable (an unofficial Indian Railways GTFS feed), not live running status. Check running status on NTES and confirm details on IRCTC before you travel.",
  },
  {
    q: "Where can I book the ticket?",
    a: "On the IRCTC website, or in the official IRCTC Rail Connect and RailOne apps. The Book button opens IRCTC on a computer and offers the apps on a phone.",
  },
  {
    q: "Is Bogiey free? Is it an official Indian Railways site?",
    a: "It is free and needs no sign-up. It is an independent tool and is not affiliated with Indian Railways, CRIS or IRCTC.",
  },
];
