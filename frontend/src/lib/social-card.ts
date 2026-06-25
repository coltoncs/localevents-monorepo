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

// satori-html does NOT decode HTML entities (they'd render literally, e.g.
// "&amp;"), so we can't entity-encode. The only characters that break parsing
// in text content are angle brackets; strip them and leave everything else
// (&, ", ') as literal text.
function esc(s: string): string {
	return String(s ?? "").replace(/[<>]/g, "");
}

function eventRow(e: CardEvent): string {
	const meta = [e.venue, e.category].filter(Boolean).map(esc).join(" · ");
	// Featured marker: a CSS-drawn amber dot (a ★ glyph isn't in the Inter
	// subset and would render as tofu).
	const star = e.featured
		? `<div style="display:flex;width:14px;height:14px;border-radius:7px;background-color:#ffd27a;flex-shrink:0;"></div>`
		: "";
	return `
    <div style="display:flex;flex-direction:row;align-items:flex-start;gap:14px;">
      <div style="display:flex;width:130px;flex-shrink:0;color:#ffd27a;font-size:22px;font-weight:700;">${esc(e.time)}</div>
      <div style="display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;flex-direction:row;align-items:center;gap:8px;">
          ${star}
          <div style="display:flex;flex:1;color:#ffffff;font-size:24px;font-weight:600;">${esc(e.title)}</div>
        </div>
        ${meta ? `<div style="display:flex;color:rgba(255,255,255,0.72);font-size:18px;font-weight:400;margin-top:2px;">${meta}</div>` : ""}
      </div>
    </div>`;
}

function dayBlock(d: CardDay): string {
	return `
    <div style="display:flex;flex-direction:column;">
      <div style="display:flex;color:#bdeee4;font-size:24px;font-weight:700;margin-bottom:10px;">${esc(d.label)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${d.events.map(eventRow).join("")}
      </div>
    </div>`;
}

export function buildCardHtml(data: CardData): string {
	const bg = data.bgUrl
		? `<img src="${esc(data.bgUrl)}" style="position:absolute;top:0;left:0;width:1080px;height:1350px;object-fit:cover;" />`
		: "";

	// Satori requires any element with >1 child to declare display:flex. The
	// HTML-string parser turns whitespace between tags into text nodes, which
	// counts toward that — so strip inter-tag whitespace before returning.
	const html = `
  <div style="display:flex;flex-direction:column;position:relative;width:1080px;height:1350px;font-family:Inter;background-color:#0d5c63;">
    ${bg}
    <div style="display:flex;position:absolute;top:0;left:0;width:1080px;height:1350px;background:linear-gradient(180deg, rgba(8,40,43,0.70) 0%, rgba(8,40,43,0.90) 50%, rgba(5,25,27,0.97) 100%);"></div>
    <div style="display:flex;flex-direction:column;position:relative;width:1080px;height:1350px;padding:64px;">
      <div style="display:flex;color:rgba(255,255,255,0.85);font-size:22px;font-weight:600;letter-spacing:2px;">919EVENTS.COM</div>
      <div style="display:flex;color:#ffffff;font-size:72px;font-weight:700;margin-top:10px;">${esc(data.heading)}</div>
      <div style="display:flex;color:#7fd1c1;font-size:30px;font-weight:600;margin-top:8px;">${esc(data.subheading)}</div>
      <div style="display:flex;width:120px;height:5px;background-color:#ffd27a;margin-top:24px;margin-bottom:32px;border-radius:3px;"></div>
      <div style="display:flex;flex-direction:column;flex:1;gap:26px;">
        ${data.days.map(dayBlock).join("")}
      </div>
      <div style="display:flex;color:rgba(255,255,255,0.75);font-size:20px;font-weight:400;margin-top:24px;">See all events & details at 919events.com</div>
    </div>
  </div>`;
	return html.replace(/>\s+</g, "><").trim();
}
