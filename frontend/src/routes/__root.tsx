import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { ClerkTokenProvider } from "../components/auth/ClerkTokenProvider";
import { ChatLauncher } from "../components/chat/ChatLauncher";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";
import { EmailNotifBanner } from "../components/notifications/EmailNotifBanner";
import ClerkProvider from "../integrations/clerk/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import { pageView } from "../lib/analytics";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

// Marketing/analytics tags load only in production builds with their env var
// configured, so `pnpm dev` and any build missing the var never pollute a
// property or pixel. Each tag is independent — set only the ones you use.
//   VITE_GA_MEASUREMENT_ID  GA4, e.g. G-XXXXXXXXXX
//   VITE_GOOGLE_ADS_ID      Google Ads tag, e.g. AW-XXXXXXXXX (remarketing +
//                           conversion import; conversions fire via gtag too)
//   VITE_META_PIXEL_ID      Meta (Facebook/Instagram) Pixel, e.g. 1234567890
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GOOGLE_ENABLED = import.meta.env.PROD && (!!GA_ID || !!ADS_ID);
const META_ENABLED = import.meta.env.PROD && !!META_PIXEL_ID;

// gtag.js powers both GA4 and Google Ads from one loader; each destination is
// registered with its own config() call. The Meta Pixel is a separate snippet.
const ANALYTICS_SCRIPTS: Array<
	{ src: string; async: true } | { children: string }
> = [
	...(GOOGLE_ENABLED
		? [
				{
					src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID ?? ADS_ID}`,
					async: true as const,
				},
				{
					children:
						"window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());" +
						(GA_ID ? `gtag('config','${GA_ID}');` : "") +
						(ADS_ID ? `gtag('config','${ADS_ID}');` : ""),
				},
			]
		: []),
	...(META_ENABLED
		? [
				{
					children:
						"!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
						`fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
				},
			]
		: []),
];

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "919Events" },
			{
				name: "description",
				content:
					"Discover local concerts, meetups, festivals, and more happening near you.",
			},
			{ property: "og:site_name", content: "919Events" },
			{ property: "og:type", content: "website" },
			{ name: "twitter:card", content: "summary" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.png", type: "image/png" },
		],
		scripts: ANALYTICS_SCRIPTS,
	}),
	shellComponent: RootDocument,
});

// Fires a Meta Pixel PageView on every client-side route change. The Pixel
// snippet only fires once on first load; GA4 enhanced measurement already
// tracks SPA history changes, so this is Meta-only. Renders nothing.
function RouteAnalytics() {
	const router = useRouter();
	useEffect(() => {
		return router.subscribe("onResolved", () => pageView());
	}, [router]);
	return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
				<ClerkProvider>
					<ClerkTokenProvider>
						<TanStackQueryProvider>
							<RouteAnalytics />
							<Header />
							<EmailNotifBanner />
							{children}
							<Footer />
							<ChatLauncher />
							<TanStackDevtools
								config={{
									// bottom-left so it doesn't overlap the ChatLauncher (bottom-right)
									position: "bottom-left",
								}}
								plugins={[
									{
										name: "Tanstack Router",
										render: <TanStackRouterDevtoolsPanel />,
									},
									TanStackQueryDevtools,
								]}
							/>
						</TanStackQueryProvider>
					</ClerkTokenProvider>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
