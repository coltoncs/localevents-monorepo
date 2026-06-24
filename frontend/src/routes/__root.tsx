import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ClerkTokenProvider } from "../components/auth/ClerkTokenProvider";
import { EmailNotifBanner } from "../components/notifications/EmailNotifBanner";
import { PWARegister } from "../components/PWARegister";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";
import ClerkProvider from "../integrations/clerk/provider";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content:
					"width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ title: "919Events" },
			{
				name: "description",
				content:
					"Discover local concerts, meetups, festivals, and more happening near you.",
			},
			{ property: "og:site_name", content: "919Events" },
			{ property: "og:type", content: "website" },
			{ name: "twitter:card", content: "summary" },
			// PWA / mobile install metadata
			{ name: "theme-color", content: "#000000" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-title", content: "919 Events" },
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.png", type: "image/png" },
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png" },
		],
		scripts: [
			{
				src: "https://www.googletagmanager.com/gtag/js?id=G-L9BV0QRP8Y",
				async: true,
			},
			{
				children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-L9BV0QRP8Y');`,
			},
		],
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
							<PWARegister />
							<Header />
							<EmailNotifBanner />
							{children}
							<Footer />
							<TanStackDevtools
								config={{
									position: "bottom-right",
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
