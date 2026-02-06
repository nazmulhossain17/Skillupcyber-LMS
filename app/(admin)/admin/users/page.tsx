// app/admin/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  Mail,
  Calendar,
  Phone,
  Globe,
  Clock,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type User = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  role: "student" | "instructor" | "admin" | null;
  isActive: boolean;
  lastLoginAt: string | null;
  phone: string | null;
  country: string | null;
  bio: string | null;
  avatar: string | null;
  timezone: string | null;
};

function RoleBadge({ role }: { role: string | null }) {
  // ✅ Handle null/undefined role with default
  const safeRole = role || 'student';
  
  const roles = {
    admin: { icon: ShieldCheck, color: "text-red", bg: "bg-red-light-5" },
    instructor: { icon: Shield, color: "text-primary", bg: "bg-blue-light-5" },
    student: { icon: Shield, color: "text-green", bg: "bg-green-light-5" },
  };

  const { icon: Icon, color, bg } = roles[safeRole as keyof typeof roles] || roles.student;

  // ✅ Safe string manipulation
  const displayRole = safeRole.charAt(0).toUpperCase() + safeRole.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${bg} ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {displayRole}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/users?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to load users");

      const data = await res.json();
      setUsers(data.users);
      setTotal(data.pagination.total);
    } catch (err) {
      toast.error("Failed to load users");
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-heading-1 font-bold text-dark dark:text-white mb-2">
          Users Management
        </h1>
        <p className="text-body-2xlg text-dark-5 dark:text-dark-6">
          Manage platform users, roles, and access
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-dark-5 dark:text-dark-6" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-12 pr-4 py-3.5 rounded-lg border custom-border-stroke bg-gray-1 dark:bg-dark-2 text-dark dark:text-white placeholder-dark-5 dark:placeholder-dark-6 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-1 dark:bg-dark-2 border custom-border-stroke rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-3 dark:bg-dark-3 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-3 dark:bg-dark-3 rounded w-32" />
                    <div className="h-4 bg-gray-3 dark:bg-dark-3 rounded w-48" />
                  </div>
                </div>
              </div>
            ))
          : users.map((user) => (
              <div
                key={user.id}
                className="bg-gray-1 dark:bg-dark-2 border custom-border-stroke rounded-xl p-6 hover:shadow-card-2 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Image
                        src={user.avatar || user.image || "/images/user-placeholder.png"}
                        alt={user.name || "User"}
                        width={64}
                        height={64}
                        className="rounded-full border-4 border-white dark:border-dark-2 shadow-card"
                      />
                      {user.isActive ? (
                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-green rounded-full border-2 border-white dark:border-dark-2" />
                      ) : (
                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-gray-5 rounded-full border-2 border-white dark:border-dark-2" />
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-dark dark:text-white text-lg">
                        {user.name || "Unnamed User"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <RoleBadge role={user.role} />
                        {user.emailVerified ? (
                          <Mail className="h-4 w-4 text-green" />
                        ) : (
                          <Mail className="h-4 w-4 text-dark-5"/>
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-2 dark:hover:bg-dark-3 rounded-lg">
                    <MoreVertical className="h-5 w-5 text-dark-5 dark:text-dark-6" />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-dark-5 dark:text-dark-6">Email</p>
                  <p className="font-medium text-dark dark:text-white truncate">{user.email}</p>
                </div>

                {user.lastLoginAt && (
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Clock className="h-4 w-4 text-dark-5 dark:text-dark-6" />
                    <span className="text-dark-5 dark:text-dark-6">Last login:</span>
                    <span className="font-medium text-dark dark:text-white">
                      {format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm")}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm mb-4">
                  <Calendar className="h-4 w-4 text-dark-5 dark:text-dark-6" />
                  <span className="text-dark-5 dark:text-dark-6">Joined:</span>
                  <span className="font-medium text-dark dark:text-white">
                    {format(new Date(user.createdAt), "dd MMM yyyy")}
                  </span>
                </div>

                {(user.phone || user.country) && (
                  <div className="flex items-center gap-4 text-sm text-dark-5 dark:text-dark-6">
                    {user.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.country && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>{user.country}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-stroke dark:border-dark-3">
                  <span className="text-sm text-dark-5 dark:text-dark-6">
                    Account {user.isActive ? "Active" : "Inactive"}
                  </span>
                  <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.isActive ? "bg-primary" : "bg-gray-4 dark:bg-dark-4"}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${user.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
      </div>

      {/* Empty State */}
      {!loading && users.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-2 dark:bg-dark-3 mb-4">
            <Search className="h-8 w-8 text-dark-5 dark:text-dark-6" />
          </div>
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
            No users found
          </h3>
          <p className="text-dark-5 dark:text-dark-6">
            {search ? 'Try adjusting your search' : 'No users registered yet'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-1 dark:bg-dark-2 border custom-border-stroke text-dark dark:text-white disabled:opacity-50 hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" /> Previous
          </button>

          <span className="text-dark-5 dark:text-dark-6">
            Page <strong className="text-dark dark:text-white">{page}</strong> of{" "}
            <strong className="text-dark dark:text-white">{totalPages}</strong>
          </span>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-1 dark:bg-dark-2 border custom-border-stroke text-dark dark:text-white disabled:opacity-50 hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
          >
            Next <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}