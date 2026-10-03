import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

import HomePage from '@/pages/home';
import HistoryPage from '@/pages/history';
import LoginPage from '@/pages/login';
import SignUpPage from '@/pages/signup';
import PastReportsPage from '@/pages/past-reports';
import ReportDetailPage from '@/pages/report-detail';
import SubmissionsPage from '@/pages/submissions';
import SubmissionDetailPage from '@/pages/submission-detail';
import StaffPage from '@/pages/staff';
import StaffDetailPage from '@/pages/staff-detail';
import StaffAccountsPage from '@/pages/staff-accounts';
import { Unauthorized } from '@/components/submission-ui';
import { isStaffRole } from '@/lib/roles';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 30_000 },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
        <p>Unable to check your session. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  const authPage = location === '/login' || location === '/signup';
  if (!user && !authPage) return <Redirect to="/login" />;
  const isStaff = isStaffRole(user?.role);
  if (user && authPage) return <Redirect to={isStaff ? '/staff' : '/'} />;
  const staffUrl = location === '/staff' || location.startsWith('/staff/');
  if (user && staffUrl && !isStaff) return <Unauthorized />;
  if (user && !isStaff && user.role !== 'resident') return <Unauthorized />;
  // Staff never mount resident pages, even when following a saved URL.
  if (user && isStaff && !staffUrl) {
    const submissionDetail = /^\/submissions\/(\d+)$/.exec(location);
    return <Redirect to={submissionDetail ? `/staff/submissions/${submissionDetail[1]}` : '/staff'} />;
  }

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignUpPage} />
        <Route path="/" component={HomePage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/reports" component={PastReportsPage} />
        <Route path="/reports/:id" component={ReportDetailPage} />
        <Route path="/submissions" component={SubmissionsPage} />
        <Route path="/submissions/:id" component={SubmissionDetailPage} />
        <Route path="/staff" component={StaffPage} />
        <Route path="/staff/accounts" component={StaffAccountsPage} />
        <Route path="/staff/submissions/:id" component={StaffDetailPage} />
        <Route path="/staff/reports/:id" component={ReportDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
