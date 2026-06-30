import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ClerkTokenProvider } from "../components/auth/ClerkTokenProvider";
import { ChatLauncher } from "../components/chat/ChatLauncher";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";
import { EmailNotifBanner } from "../components/notifications/EmailNotifBanner";
import ClerkProvider from "../integrations/clerk/provider";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

// GA4 is loaded only in production builds with a configured measurement ID, so
// `pnpm dev` and any build missing the env var never pollute the analytics property.
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const GA_ENABLED = import.meta.env.PROD && !!GA_ID;

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
		scripts: GA_ENABLED
			? [
					{
						src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
						async: true,
					},
					{
						children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
					},
				]
			: [],
	}),
	shellComponent: RootDocument,
});

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
