import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Printer,
  Bell,
  Check,
  ChevronRight,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { 
  useListSamples,
  useAnalyzeLetter,
  useGetReport,
  useUpdateReportItem,
  useListNotifications,
  useLogOut,
  getGetReportQueryKey,
  getListReportsQueryKey,
  getListNotificationsQueryKey,
  ReportItem
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import QuestionPanel from "@/components/question-panel";

export default function Home() {
  const [reportId, setReportId] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Permit Correction Helper";
  }, []);

  // If we have a report ID, show the report view, else show the upload view
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <TopNav />
      
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        {!reportId ? (
          <UploadFlow onReportGenerated={(id) => setReportId(id)} />
        ) : (
          <ReportView reportId={reportId} onReset={() => setReportId(null)} />
        )}
      </main>
    </div>
  );
}

export function TopNav() {
  const { data: notifications } = useListNotifications();
  const unreadCount = notifications?.length || 0;
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogOut();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10 no-print">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <ShieldAlert className="w-6 h-6" />
          <h1 className="font-serif font-semibold text-lg md:text-xl tracking-tight">
            <span className="sm:hidden">Permit</span>
            <span className="hidden sm:inline">Permit Correction Helper</span>
          </h1>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Main navigation">
          <Link href="/" aria-current={location === "/" ? "page" : undefined} className={`hidden sm:inline-flex px-2 py-2 text-sm rounded-md transition-colors ${location === "/" ? "text-primary font-semibold bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>
            Home
          </Link>
          <Link href="/history" aria-current={location === "/history" ? "page" : undefined} className={`px-2 py-2 text-sm rounded-md transition-colors ${location === "/history" ? "text-primary font-semibold bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>
            History
          </Link>
          <Link href="/reports" aria-current={location.startsWith("/reports") ? "page" : undefined} className={`px-2 py-2 text-sm rounded-md transition-colors ${location.startsWith("/reports") ? "text-primary font-semibold bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="sm:hidden">Reports</span><span className="hidden sm:inline">Past Reports</span>
          </Link>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b border-border font-medium">Notifications</div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!notifications || notifications.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {notifications.map((n: any) => (
                    <div key={n.id} className="p-3 rounded-md hover:bg-muted text-sm transition-colors">
                      <p className="text-foreground">{n.message}</p>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {format(new Date(n.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logout.isPending} aria-label="Log out" className="text-muted-foreground hover:text-foreground px-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline ml-1">Log Out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function UploadFlow({ onReportGenerated }: { onReportGenerated: (id: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: samples, isLoading: loadingSamples } = useListSamples();
  const analyze = useAnalyzeLetter();
  const queryClient = useQueryClient();

  const reportSaved = (id: number) => {
    queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    onReportGenerated(id);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString() || '';
      // Strip off the data:image/png;base64, part if present
      const commaIdx = encoded.indexOf(',');
      if (commaIdx !== -1) {
        encoded = encoded.substring(commaIdx + 1);
      }
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });

  const runAnalysisWithFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const base64 = await toBase64(file);
      analyze.mutate({
        data: {
          fileName: file.name,
          mimeType: file.type,
          fileData: base64
        }
      }, {
        onSuccess: (data: any) => reportSaved(data.id),
        onSettled: () => setIsProcessing(false)
      });
    } catch (e) {
      setIsProcessing(false);
    }
  };

  const runAnalysisWithSample = (sampleId: string) => {
    setIsProcessing(true);
    analyze.mutate({
      data: { sampleId }
    }, {
      onSuccess: (data: any) => reportSaved(data.id),
      onSettled: () => setIsProcessing(false)
    });
  };

  if (isProcessing || analyze.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-serif font-medium">Analyzing Correction Letter...</h2>
          <p className="text-muted-foreground">
            Our AI is reading your document, classifying required actions by department, and clarifying confusing planner jargon.
          </p>
        </div>
        <Progress value={65} className="w-64" />
      </div>
    );
  }

  if (analyze.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-serif font-medium text-destructive">Failed to analyze</h2>
          <p className="text-muted-foreground">There was an issue processing this document. Please try a different file or sample.</p>
        </div>
        <Button onClick={() => analyze.reset()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="text-center space-y-4 pt-8">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
          AI-Powered Coordination
        </Badge>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
          Turn dense permit corrections into a clear checklist.
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Upload your city correction letter. We extract what's met, what needs fixing, and explain bureaucratic comments in plain English.
        </p>
      </div>

      <QuestionPanel />

      <Card className="border-dashed border-2 shadow-none border-border/60">
        <CardContent className="p-8">
          <div 
            className={`
              flex flex-col items-center justify-center p-8 text-center rounded-xl border-2 border-transparent transition-all
              ${dragActive ? 'bg-primary/5 border-primary border-dashed' : 'bg-background hover:bg-muted/50'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-6 h-6" />
            </div>
            {file ? (
              <div className="space-y-4">
                <p className="font-medium text-foreground">{file.name}</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => setFile(null)}>Remove</Button>
                  <Button onClick={runAnalysisWithFile}>Analyze Document</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Drag & drop your letter here</h3>
                <p className="text-sm text-muted-foreground">Supports PDF, PNG, JPG up to 10MB</p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-border flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">Don't have a letter handy? Try a sample.</p>
            
            {loadingSamples ? (
              <div className="flex gap-2 justify-center">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {samples?.map((sample: any) => (
                  <Dialog key={sample.id}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="bg-secondary/50 text-secondary-foreground hover:bg-secondary">
                        {sample.title}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{sample.title}</DialogTitle>
                        <DialogDescription>{sample.description}</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm">This will run a simulated analysis using a standard City correction letter for this project type.</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <DialogTrigger asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogTrigger>
                        <Button onClick={() => runAnalysisWithSample(sample.id)}>
                          Use Sample & Analyze
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 opacity-80">
        <AlertCircle className="w-3.5 h-3.5" />
        AI analysis may contain inaccuracies. Always review with your architect or engineer.
      </p>
    </div>
  );
}

export function ReportView({ reportId, onReset }: { reportId: number, onReset: () => void }) {
  const queryClient = useQueryClient();
  const { data: report, isLoading, isError } = useGetReport(reportId);
  const updateItem = useUpdateReportItem();
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="py-20 text-center">
        <p className="text-destructive font-medium mb-4">Error loading report.</p>
        <Button onClick={onReset} variant="outline">Go Back</Button>
      </div>
    );
  }

  return <ReportContent report={report} reportId={reportId} onReset={onReset} updateItem={updateItem} queryClient={queryClient} />;
}

function ReportContent({ report, reportId, onReset, updateItem, queryClient }: { report: any, reportId: number, onReset: () => void, updateItem: any, queryClient: any }) {
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  const handleToggleComplete = (itemId: number, completed: boolean) => {
    updateItem.mutate({
      reportId,
      itemId,
      data: { completed }
    }, {
      onSuccess: (updatedItem: ReportItem) => {
        // Optimistic-like update by patching cache
        queryClient.setQueryData(getGetReportQueryKey(reportId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((it: ReportItem) => 
              it.id === updatedItem.id ? updatedItem : it
            )
          };
        });
      }
    });
  };

  const departments = Array.from(new Set(report.items.map((i: ReportItem) => i.department)));
  const totalNeedsFix = report.items.filter((i: ReportItem) => i.status === 'needs_fix').length;
  const completedNeedsFix = report.items.filter((i: ReportItem) => i.status === 'needs_fix' && i.completed).length;
  const progress = totalNeedsFix === 0 ? 100 : Math.round((completedNeedsFix / totalNeedsFix) * 100);
  const prevProgress = useRef<number>(progress);

  useEffect(() => {
    if (progress === 100 && prevProgress.current < 100) {
      setShowSuccessDialog(true);
    }
    prevProgress.current = progress;
  }, [progress]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-accent">
              <CheckCircle2 className="w-6 h-6" /> Ready to Resubmit
            </DialogTitle>
            <DialogDescription>
              You've marked all corrections as completed. You can now download the PDF checklist to include with your resubmittal package.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => {
              setShowSuccessDialog(false);
              window.print();
            }}>
              <Printer className="w-4 h-4 mr-2" /> Download Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <Badge variant="outline" className="text-muted-foreground mb-2">
            Correction Report
          </Badge>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {report.address}
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            {report.summary}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 no-print">
          <Button variant="outline" onClick={onReset} className="hidden sm:inline-flex">
            New Letter
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {totalNeedsFix > 0 && (
        <Card className="bg-primary/5 border-primary/20 no-print">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-2 w-full">
              <div className="flex justify-between items-end">
                <span className="font-medium text-primary">Resolution Progress</span>
                <span className="text-sm text-primary/70">{completedNeedsFix} of {totalNeedsFix} tasks completed</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            {progress === 100 && (
              <div className="flex items-center gap-2 text-accent bg-accent/10 px-4 py-2 rounded-lg font-medium animate-in zoom-in">
                <CheckCircle2 className="w-5 h-5" />
                All clear! Ready to resubmit.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-10">
        {departments.map(dept => {
          const deptItems = report.items.filter((i: ReportItem) => i.department === dept);
          const needsFix = deptItems.filter((i: ReportItem) => i.status === 'needs_fix');
          const met = deptItems.filter((i: ReportItem) => i.status === 'met');

          return (
            <div key={dept as string} className="space-y-6">
              <h2 className="text-2xl font-serif font-semibold border-b border-border/50 pb-2">
                {dept as string}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Needs Fix Column */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Needs Fix ({needsFix.length})
                  </h3>
                  {needsFix.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic p-4 rounded-md bg-muted/30">
                      No corrections needed for this department.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {needsFix.map((item: ReportItem) => (
                        <Card 
                          key={item.id} 
                          className={`print-break-inside-avoid transition-colors ${item.completed ? 'opacity-60 bg-muted/30' : ''} ${item.unclear ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
                        >
                          <CardContent className="p-4 flex gap-4">
                            <div className="pt-0.5 no-print">
                              <Checkbox 
                                checked={item.completed}
                                onCheckedChange={(c) => handleToggleComplete(item.id, c === true)}
                                className={item.completed ? "data-[state=checked]:bg-muted-foreground data-[state=checked]:text-muted-foreground-foreground border-muted-foreground" : ""}
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex gap-2 justify-between items-start">
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{item.category}</Badge>
                                {item.unclear && (
                                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 gap-1 px-1.5 py-0">
                                    <HelpCircle className="w-3 h-3" /> Unclear Jargon
                                  </Badge>
                                )}
                              </div>
                              <p className={`text-sm text-foreground leading-relaxed ${item.completed ? 'line-through decoration-muted-foreground/30' : ''}`}>
                                "{item.comment}"
                              </p>
                              <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/10 relative">
                                <div className="absolute -left-1.5 top-3 w-3 h-3 bg-background border border-primary/20 rotate-45" />
                                <span className="text-xs font-semibold text-primary uppercase block mb-1">How to fix</span>
                                <p className="text-sm text-foreground/80">{item.howToFix}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Met Column */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-accent">
                    <CheckCircle2 className="w-4 h-4" />
                    Conditions Met ({met.length})
                  </h3>
                  {met.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic p-4 rounded-md bg-muted/30">
                      None documented as met.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {met.map((item: ReportItem) => (
                        <Card key={item.id} className="bg-background print-break-inside-avoid shadow-sm border-border/50">
                          <CardContent className="p-4 flex gap-3 opacity-80">
                            <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-foreground/90 leading-relaxed italic">
                                "{item.comment}"
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">No further action required.</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
