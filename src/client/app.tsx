import { useEffect, type ReactNode } from 'react';
import { Link, matchPath, RouterProvider, useRouteFocus, useRouter } from './lib/router.tsx';
import { SessionProvider, useSession } from './lib/session.tsx';
import { SetupProvider, useSetup } from './lib/setup.tsx';
import { Loading, Logo } from './ui/bits.tsx';
import { HomePage, CareersPage } from './features/home.tsx';
import { CareerPage } from './features/career.tsx';
import { SubjectsPage } from './features/subjects.tsx';
import { MarksPage } from './features/marks.tsx';
import { PlanPage, ExplorePage } from './features/plan.tsx';
import { LoginPage, SignupPage, VerifyPage, ForgotPage } from './features/auth.tsx';
import { TeachHome, ClassPage, TeacherLearnerPage } from './features/teach.tsx';
import { AccountPage, NotFound, PrivacyPage, SchoolsPage, SourcesPage } from './features/pages.tsx';
import { careerById } from '../shared/data/careers.ts';

export function App() {
  return (
    <RouterProvider>
      <SessionProvider>
        <SetupProvider>
          <Shell />
        </SetupProvider>
      </SessionProvider>
    </RouterProvider>
  );
}

interface Tab {
  to: string;
  label: string;
  match: (p: string) => boolean;
}

function Shell() {
  const { path } = useRouter();
  const { me } = useSession();
  const { setup } = useSetup();
  useRouteFocus(path);
  useEffect(() => {
    document.title = titleFor(path);
  }, [path]);

  const teacher = me?.user?.role === 'teacher';
  const tabs: Tab[] = [
    { to: '/', label: 'Careers', match: (p) => p === '/' || p.startsWith('/careers') || p === '/explore' },
    { to: '/subjects', label: 'Subjects', match: (p) => p === '/subjects' },
    { to: '/marks', label: 'Marks', match: (p) => p === '/marks' },
    teacher ? { to: '/teach', label: 'Classes', match: (p) => p.startsWith('/teach') } : { to: '/plan', label: 'My plan', match: (p) => p === '/plan' },
  ];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Umzila home">
            <Logo />
            <span className="brand-by">by Magubane Labs</span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to} aria-current={t.match(path) ? 'page' : undefined}>
                {t.label}
                {t.to === '/plan' && setup.careers.length ? <span className="count num">{setup.careers.length}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="topbar-account">
            {me?.user ? (
              <Link to="/account" aria-current={path === '/account' ? 'page' : undefined}>
                {me.user.displayName}
              </Link>
            ) : me ? (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  <span>Sign up</span>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main id="main" className="main">
        <Routes />
      </main>
      <footer className="footer">
        <p>
          Umzila, by <a href="https://magubanelabs.co.za">Magubane Labs</a>. Requirements change every year: always confirm with the institution before you apply.
        </p>
        <p>
          <Link to="/sources">Where our information comes from</Link> <Link to="/schools">For schools</Link> <Link to="/privacy">Privacy</Link>
        </p>
      </footer>
      <nav className="bottomnav" aria-label="Main">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} aria-current={t.match(path) ? 'page' : undefined}>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function Routes() {
  const { path } = useRouter();
  const { me } = useSession();
  let m: Record<string, string> | null;

  if (path === '/') return <HomePage />;
  if (path === '/careers') return <CareersPage />;
  if ((m = matchPath('/careers/:id', path))) return <CareerPage id={m.id!} />;
  if (path === '/subjects') return <SubjectsPage />;
  if (path === '/marks') return <MarksPage />;
  if (path === '/plan') return <PlanPage />;
  if (path === '/explore') return <ExplorePage />;
  if (path === '/login') return <LoginPage />;
  if (path === '/signup') return <SignupPage />;
  if (path === '/verify') return <VerifyPage />;
  if (path === '/forgot') return <ForgotPage />;
  if (path === '/account') return <AccountPage />;
  if (path === '/schools') return <SchoolsPage />;
  if (path === '/sources') return <SourcesPage />;
  if (path === '/privacy') return <PrivacyPage />;

  if (path.startsWith('/teach')) {
    if (!me) return <Loading />;
    if (!me.user) return <Gate>Log in with your teacher account to see your classes.</Gate>;
    if (me.user.role !== 'teacher') return <Gate>Classes are for teacher accounts.</Gate>;
    if (!me.user.emailVerified) return <Gate verify>Confirm your email address first.</Gate>;
    if (path === '/teach') return <TeachHome />;
    if ((m = matchPath('/teach/:id', path))) return <ClassPage id={m.id!} />;
    if ((m = matchPath('/teach/:id/learners/:learnerId', path))) return <TeacherLearnerPage classId={m.id!} learnerId={m.learnerId!} />;
  }
  return <NotFound />;
}

function Gate({ children, verify = false }: { children: ReactNode; verify?: boolean }) {
  return (
    <div className="prose">
      <h1>{verify ? 'One more step' : 'Teachers only'}</h1>
      <p>{children}</p>
      <p>{verify ? <Link to="/verify">Enter your code</Link> : <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`}>Log in</Link>}</p>
    </div>
  );
}

function titleFor(path: string): string {
  const m = matchPath('/careers/:id', path);
  if (m) {
    const c = careerById(m.id!);
    if (c) return `${c.name}: route and requirements | Umzila`;
  }
  const map: Record<string, string> = {
    '/': 'Umzila: what do you want to become?',
    '/careers': 'All careers | Umzila',
    '/subjects': 'Your subjects | Umzila',
    '/marks': 'Your marks | Umzila',
    '/plan': 'My plan | Umzila',
    '/explore': 'Start from what you enjoy | Umzila',
    '/schools': 'For schools | Umzila',
    '/sources': 'Sources | Umzila',
    '/privacy': 'Privacy | Umzila',
  };
  return map[path] ?? 'Umzila';
}
