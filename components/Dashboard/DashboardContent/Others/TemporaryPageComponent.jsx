// components/Dashboard/DashboardContent/Others/TemporaryPageComponent.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Construction, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TemporaryPage() {
  const [dots, setDots] = useState(".");
  const [progress, setProgress] = useState(0);
  const [features, setFeatures] = useState([
    { name: "Payroll", icon: <Calendar className="h-4 w-4" />, progress: 20 },
    { name: "Referral", icon: <Calendar className="h-4 w-4" />, progress: 5 },
    { name: "Overview", icon: <Calendar className="h-4 w-4" />, progress: 80 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 5;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFeatures((prev) =>
        prev.map((feature) => ({
          ...feature,
          progress: Math.min(feature.progress + (Math.random() > 0.7 ? 1 : 0), 100),
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col rounded-2xl items-center justify-center bg-gradient-to-b from-background to-orange-50/20 dark:from-background dark:to-orange-950/10">
      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-col items-center text-center space-y-8 mb-8">
          <div className="relative">
            <div className="relative bg-orange-100 dark:bg-orange-950/30 p-6 rounded-full">
              <Construction className="h-20 w-20 text-orange-500 dark:text-orange-400" />
              <div
                className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-dashed border-orange-300 dark:border-orange-700/70 animate-spin-slow"
                style={{ animationDuration: "10s" }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Badge className="bg-orange-500 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-600 px-3 py-1 text-sm">
              Coming Soon
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-orange-400 dark:from-orange-500 dark:to-orange-300 bg-clip-text text-transparent">
              Under Construction
            </h1>
          </div>

          <p className="text-lg text-muted-foreground max-w-md">
            We're working hard to bring you something amazing. Please check back soon
            <span className="inline-block w-8 text-left">{dots}</span>
          </p>
        </div>

        <Card className="shadow-lg border-orange-200 dark:border-orange-900 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-500 to-orange-300 dark:from-orange-600 dark:to-orange-800" />
          <div className="absolute inset-0 bg-orange-50/50 dark:bg-orange-950/20 z-0"></div>

          <CardHeader className="relative z-10 pb-2">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-orange-500 dark:text-orange-400" />
              <h2 className="text-xl font-semibold">Project Progress</h2>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 pt-4">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Overall Completion</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-orange-100 dark:bg-orange-900/40 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-600 to-orange-400 dark:from-orange-500 dark:to-orange-300 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Feature Development</h3>
                {features.map((feature, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center">
                        <span className="text-orange-500 dark:text-orange-400">{feature.icon}</span>
                        <span className="ml-2">{feature.name}</span>
                      </div>
                      <span className="text-xs font-medium">{feature.progress}%</span>
                    </div>
                    <div className="w-full bg-orange-100 dark:bg-orange-900/40 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-orange-400 dark:bg-orange-500 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${feature.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Thank you for your patience as we improve your experience.</p>
        </div>
      </div>
    </div>
  );
}
