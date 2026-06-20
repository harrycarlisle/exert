import type { ComponentType, SVGProps } from "react";

const morningTeeUrl = "https://morningtee.com/";

type IconProps = SVGProps<SVGSVGElement>;

type Project = {
  title: string;
  description: string;
  cta: string;
  href?: string;
  accent: "purple" | "green" | "amber" | "gray";
  Icon: ComponentType<IconProps>;
};

const accentStyles = {
  purple: {
    icon: "border-violet-400/50 bg-violet-400/10 text-violet-300 shadow-[0_0_38px_rgba(139,92,246,0.22)]",
    text: "text-violet-300",
    hover: "group-hover:border-violet-300/35"
  },
  green: {
    icon: "border-lime-400/50 bg-lime-400/10 text-lime-300 shadow-[0_0_38px_rgba(132,204,22,0.18)]",
    text: "text-lime-300",
    hover: "group-hover:border-lime-300/35"
  },
  amber: {
    icon: "border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_38px_rgba(245,158,11,0.18)]",
    text: "text-amber-300",
    hover: "group-hover:border-amber-300/35"
  },
  gray: {
    icon: "border-white/15 bg-white/[0.06] text-zinc-300",
    text: "text-zinc-400",
    hover: "group-hover:border-white/20"
  }
};

const projects: Project[] = [
  {
    title: "Ultimate",
    description: "Tools and resources for ultimate players, coaches, and teams.",
    cta: "Visit Ultimate",
    href: "https://ultimate.exert.ca/",
    accent: "purple",
    Icon: DiscIcon
  },
  {
    title: "LifeOS",
    description: "A personal operating system for daily clarity.",
    cta: "Request access",
    href: "#",
    accent: "green",
    Icon: FocusIcon
  },
  {
    title: "Morning Tee",
    description:
      "Get research-backed golf tips and original stories on every golf tour around the world.",
    cta: "Visit Morning Tee",
    href: morningTeeUrl,
    accent: "amber",
    Icon: MorningTeeIcon
  },
  {
    title: "Coming soon",
    description: "A new system is in the works.",
    cta: "Coming soon",
    accent: "gray",
    Icon: LockIcon
  }
];

const footerLinks = [
  { label: "Ultimate", href: "https://ultimate.exert.ca/" },
  { label: "LifeOS", href: "#" },
  { label: "Morning Tee", href: morningTeeUrl },
  { label: "business@harrycarlisle.com", href: "mailto:business@harrycarlisle.com" }
];

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-5 text-stone-100 sm:px-8">
      <div className="pointer-events-none absolute right-[-12rem] top-16 -z-10 h-[34rem] w-[34rem] rounded-full bg-violet-500/20 blur-3xl" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <Header />

        <section className="flex flex-1 flex-col justify-center pb-16 pt-14 sm:pb-20 sm:pt-20">
          <div className="max-w-3xl">
            <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-normal text-stone-50 sm:text-6xl md:text-7xl">
              Everything Exert is building.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              Simple tools, systems, and projects built to make things easy.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-5 text-sm font-medium text-stone-100 shadow-card-glow transition duration-200 hover:border-white/20 hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b]"
                href="#projects"
              >
                Explore projects
                <ArrowDownIcon className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                className="inline-flex h-12 items-center justify-center gap-3 rounded-xl px-5 text-sm font-medium text-zinc-300 transition duration-200 hover:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b]"
                href="mailto:hello@exert.ca"
              >
                Get in touch
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <section
            id="projects"
            aria-label="Exert projects"
            className="mt-12 grid gap-4 sm:mt-14 md:grid-cols-2"
          >
            {projects.map((project) => (
              <ProjectCard key={project.title} project={project} />
            ))}
          </section>
        </section>

        <Footer currentYear={currentYear} />
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between py-5 sm:py-7">
      <a
        href="/"
        className="inline-flex items-center gap-3 rounded-lg text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b]"
        aria-label="Exert home"
      >
        <ExertLogoMark className="h-7 w-8" />
        <span className="text-sm font-medium tracking-normal text-stone-200">Exert</span>
      </a>

      <nav className="flex items-center gap-2 text-sm text-zinc-300 sm:gap-6" aria-label="Main navigation">
        <a className="hidden transition hover:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-300/70 sm:inline" href="#projects">
          Projects
        </a>
        <a className="hidden transition hover:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-300/70 sm:inline" href="mailto:hello@exert.ca">
          Contact
        </a>
        <a
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-black/10 px-4 text-sm font-medium text-stone-100 transition duration-200 hover:border-white/30 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b]"
          href="mailto:hello@exert.ca"
        >
          Email us
          <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
        </a>
      </nav>
    </header>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const styles = accentStyles[project.accent];
  const Icon = project.Icon;
  const content = (
    <>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${styles.icon}`}
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-9">
        <h2 className="text-2xl font-medium tracking-normal text-stone-50">
          {project.title}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          {project.description}
        </p>
      </div>
      <div className={`mt-7 inline-flex items-center gap-3 text-sm font-medium ${styles.text}`}>
        {project.cta}
        {project.href ? (
          <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        ) : null}
      </div>
    </>
  );

  const className = `group relative min-h-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/[0.42] p-6 shadow-card-glow backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-slate-900/[0.56] ${styles.hover} focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b] sm:p-7`;

  if (!project.href) {
    return (
      <article className={className}>
        <CardSurface />
        {content}
      </article>
    );
  }

  return (
    <a className={className} href={project.href} aria-label={`${project.cta}: ${project.title}`}>
      <CardSurface />
      {content}
    </a>
  );
}

function CardSurface() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.08),transparent_16rem)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </>
  );
}

function Footer({ currentYear }: { currentYear: number }) {
  return (
    <footer className="flex flex-col gap-6 border-t border-white/[0.06] py-8 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <a
          href="/"
          className="inline-flex items-center gap-3 rounded-lg text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-300/70 focus:ring-offset-2 focus:ring-offset-[#03060b]"
          aria-label="Exert home"
        >
          <ExertLogoMark className="h-6 w-7" />
          <span className="font-medium text-stone-200">Exert</span>
        </a>
        <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" aria-hidden="true" />
        <span className="text-xs text-zinc-500">© {currentYear}</span>
      </div>

      <nav className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Footer navigation">
        {footerLinks.map((link) => (
          <a
            key={link.label}
            className="transition hover:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-300/70"
            href={link.href}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}

function ExertLogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 34" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 22.8 18.6 14"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M13.4 29.5 34.8 16.5"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M23.5 31.1 40 21"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M9.2 8.6 16.4 4.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.78"
      />
    </svg>
  );
}

function DiscIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="7.2" strokeWidth="1.7" />
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FocusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5.8" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2" strokeWidth="1.7" />
    </svg>
  );
}

function MorningTeeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 7.5h9.2v6.2A4.3 4.3 0 0 1 10.9 18h-.6A4.3 4.3 0 0 1 6 13.7V7.5Z" strokeWidth="1.7" />
      <path d="M15.2 9.2h1.4a2.4 2.4 0 0 1 0 4.8h-1.4" strokeWidth="1.7" />
      <path d="M5 20h12.5" strokeWidth="1.7" />
      <path d="M8.5 4.2v-1M12.2 4.2v-1" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5.5" y="10.2" width="13" height="9" rx="2" strokeWidth="1.7" />
      <path d="M8.4 10.2V7.8a3.6 3.6 0 0 1 7.2 0v2.4" strokeWidth="1.7" />
      <path d="M12 14v1.9" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 10h10" strokeWidth="1.7" />
      <path d="m10.8 5.8 4.2 4.2-4.2 4.2" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 14 14 6" strokeWidth="1.7" />
      <path d="M7.5 6H14v6.5" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 4.5v10" strokeWidth="1.7" />
      <path d="m5.8 10.8 4.2 4.2 4.2-4.2" strokeWidth="1.7" />
    </svg>
  );
}
