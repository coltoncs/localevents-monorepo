// Builds the HTML string rendered to a PNG by Satori (via workers-og) for the
// social event-card generator. Only inline styles within Satori's flexbox CSS
// subset are used. The visual language mirrors the email digest (teal #0d5c63).

export interface CardEvent {
	title: string;
	time: string;
	venue: string;
	category: string;
	featured: boolean;
}

export interface CardDay {
	label: string;
	events: CardEvent[];
}

export interface CardData {
	city: string;
	listType: "week" | "weekend";
	heading: string;
	subheading: string;
	/** Background image as a URL or data URL. Optional — falls back to flat teal. */
	bgUrl?: string;
	days: CardDay[];
}

// Sizes scale the layout to fit the fixed 1080×1350 card. Packed cards (many
// events across several days) use the denser tier so days don't overflow.
interface Sizes {
	heading: number;
	sub: number;
	day: number;
	time: number;
	timeW: number;
	title: number;
	meta: number;
	dot: number;
	dayGap: number;
	evGap: number;
	rowGap: number;
	dayMb: number;
}

const NORMAL: Sizes = {
	heading: 64,
	sub: 26,
	day: 20,
	time: 18,
	timeW: 104,
	title: 19,
	meta: 14,
	dot: 11,
	dayGap: 18,
	evGap: 7,
	rowGap: 12,
	dayMb: 8,
};

const DENSE: Sizes = {
	heading: 54,
	sub: 24,
	day: 17,
	time: 15,
	timeW: 88,
	title: 16,
	meta: 13,
	dot: 10,
	dayGap: 12,
	evGap: 5,
	rowGap: 10,
	dayMb: 6,
};

// satori-html does NOT decode HTML entities (they'd render literally, e.g.
// "&amp;"), so we can't entity-encode. The only characters that break parsing
// in text content are angle brackets; strip them and leave everything else
// (&, ", ') as literal text.
function esc(s: string): string {
	return String(s ?? "").replace(/[<>]/g, "");
}

function eventRow(e: CardEvent, s: Sizes): string {
	const meta = [e.venue, e.category].filter(Boolean).map(esc).join(" · ");
	// Featured marker: a CSS-drawn amber dot (a ★ glyph isn't in the Inter
	// subset and would render as tofu).
	const star = e.featured
		? `<div style="display:flex;width:${s.dot}px;height:${s.dot}px;border-radius:${s.dot / 2}px;background-color:#ffd27a;flex-shrink:0;"></div>`
		: "";
	return `
    <div style="display:flex;flex-direction:row;align-items:flex-start;gap:${s.rowGap}px;">
      <div style="display:flex;width:${s.timeW}px;flex-shrink:0;color:#ffd27a;font-size:${s.time}px;font-weight:700;">${esc(e.time)}</div>
      <div style="display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;flex-direction:row;align-items:center;gap:8px;">
          ${star}
          <div style="display:flex;flex:1;color:#ffffff;font-size:${s.title}px;font-weight:600;">${esc(e.title)}</div>
        </div>
        ${meta ? `<div style="display:flex;color:rgba(255,255,255,0.72);font-size:${s.meta}px;font-weight:400;margin-top:2px;">${meta}</div>` : ""}
      </div>
    </div>`;
}

function dayBlock(d: CardDay, s: Sizes): string {
	return `
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;color:#bdeee4;font-size:${s.day}px;font-weight:700;margin-bottom:${s.dayMb}px;">${esc(d.label)}</div>
      <div style="display:flex;flex-direction:column;gap:${s.evGap}px;">
        ${d.events.map((e) => eventRow(e, s)).join("")}
      </div>
    </div>`;
}

export function buildCardHtml(data: CardData): string {
	// A 1080×1350 portrait can't legibly hold 5 events across 5 days, so cap
	// events-per-day by the number of days (events are already ranked
	// featured-first then earliest, so the cap keeps the most relevant ones).
	const perDayCap = data.days.length >= 5 ? 3 : data.days.length === 4 ? 4 : 5;
	const days = data.days.map((d) => ({
		...d,
		events: d.events.slice(0, perDayCap),
	}));

	const totalEvents = days.reduce((n, d) => n + d.events.length, 0);
	// Switch to the denser tier once content gets tall enough to risk overflow.
	const s = totalEvents > 18 || days.length > 4 ? DENSE : NORMAL;

	// width/height MUST be attributes (not just CSS) — without them Satori decodes
	// the full-resolution image just to measure it, which can blow the Worker CPU
	// limit. With them set, it hands the image straight to the rasterizer.
	const bg = data.bgUrl
		? `<img src="${esc(data.bgUrl)}" width="1080" height="1350" style="position:absolute;top:0;left:0;width:1080px;height:1350px;object-fit:cover;" />`
		: "";

	// Satori requires any element with >1 child to declare display:flex. The
	// HTML-string parser turns whitespace between tags into text nodes, which
	// counts toward that — so strip inter-tag whitespace before returning.
	const html = `
  <div style="display:flex;flex-direction:column;position:relative;width:1080px;height:1350px;font-family:Inter;background-color:#0d5c63;">
    ${bg}
    <div style="display:flex;position:absolute;top:0;left:0;width:1080px;height:1350px;background:linear-gradient(180deg, rgba(8,40,43,0.70) 0%, rgba(8,40,43,0.90) 50%, rgba(5,25,27,0.97) 100%);"></div>
    <div style="display:flex;flex-direction:column;position:relative;width:1080px;height:1350px;padding:56px;">
      <div style="display:flex;color:rgba(255,255,255,0.85);font-size:22px;font-weight:600;letter-spacing:2px;">919EVENTS.COM</div>
      <div style="display:flex;color:#ffffff;font-size:${s.heading}px;font-weight:700;margin-top:8px;">${esc(data.heading)}</div>
      <div style="display:flex;color:#7fd1c1;font-size:${s.sub}px;font-weight:600;margin-top:6px;">${esc(data.subheading)}</div>
      <div style="display:flex;width:110px;height:5px;background-color:#ffd27a;margin-top:18px;margin-bottom:24px;border-radius:3px;"></div>
      <div style="display:flex;flex-direction:column;flex:1;gap:${s.dayGap}px;">
        ${days.map((d) => dayBlock(d, s)).join("")}
      </div>
      <div style="display:flex;color:rgba(255,255,255,0.75);font-size:18px;font-weight:400;margin-top:18px;">See all events & details at 919events.com</div>
    </div>
  </div>`;
	return html.replace(/>\s+</g, "><").trim();
}
