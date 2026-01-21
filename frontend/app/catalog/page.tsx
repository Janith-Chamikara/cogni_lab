"use client";

import { useEffect, useState } from "react";
import { useAuth, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabCatalogCard } from "@/components/catalog/lab-catalog-card";
import { LabFilterBar } from "@/components/catalog/lab-filter-bar";
import api from "@/lib/axios";
import { Lab } from "@/lib/types";
import Link from "next/link";

export default function CatalogPage() {
  const { isSignedIn, getToken } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [filteredLabs, setFilteredLabs] = useState<Lab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);

  useEffect(() => {
    if (!isSignedIn) return;

    const fetchLabs = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();

        const response = await api.get<Lab[]>("/labs/catalog", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        setLabs(response.data);

        // Extract unique modules for filter
        const moduleNames = Array.from(
          new Set(
            response.data
              .map((lab) => lab.module?.moduleName)
              .filter(Boolean) as string[]
          )
        );
        setModules(moduleNames);
      } catch (error) {
        console.error("Failed to fetch labs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabs();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    let filtered = labs;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (lab) =>
          lab.labName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lab.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by module
    if (selectedModule) {
      filtered = filtered.filter(
        (lab) => lab.module?.moduleName === selectedModule
      );
    }

    setFilteredLabs(filtered);
  }, [labs, searchQuery, selectedModule]);

  return (
    <div className="min-h-screen bg-background">
      <SignedOut>
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Lab Catalog</h1>
          <p className="text-gray-500 mb-8">
            Sign in to browse available virtual labs
          </p>
          <SignInButton mode="modal">
            <Button size="lg">Sign In</Button>
          </SignInButton>
        </div>
      </SignedOut>

      {isSignedIn && (
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Lab Catalog</h1>
            <p className="text-gray-500">
              Explore and access available virtual laboratories
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <Input
              placeholder="Search labs by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />

            <LabFilterBar
              modules={modules}
              selectedModule={selectedModule}
              onModuleChange={setSelectedModule}
            />
          </div>

          {/* Labs Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading labs...</p>
            </div>
          ) : filteredLabs.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredLabs.map((lab) => (
                <Link key={lab.id} href={`/labs/${lab.id}`}>
                  <LabCatalogCard lab={lab} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 mb-4">No labs found</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedModule(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="mt-12 pt-8 border-t">
            <p className="text-sm text-gray-500">
              Showing {filteredLabs.length} of {labs.length} labs
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
