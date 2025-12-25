import Link from "next/link";
import { Lock, Clock, Eye } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 text-2xl font-bold text-indigo-600">
          <Lock className="w-8 h-8" />
          <span>LinkyLocks</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-indigo-600 hover:text-indigo-800"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Secure Link Shortening with Expiry Control
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Create short links that automatically expire by time or number of
          opens. Perfect for temporary shares, limited access, and secure
          content distribution.
        </p>

        <div className="flex justify-center gap-4 mb-16">
          <Link
            href="/signup"
            className="px-8 py-4 bg-indigo-600 text-white rounded-lg text-lg font-semibold hover:bg-indigo-700"
          >
            Get Started Free
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-4 bg-white text-indigo-600 rounded-lg text-lg font-semibold border-2 border-indigo-600 hover:bg-indigo-50"
          >
            View Pricing
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <Clock className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Time-Based Expiry</h3>
            <p className="text-gray-600">
              Set links to expire after a specific date and time.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <Eye className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Open Limits</h3>
            <p className="text-gray-600">
              Restrict links to a maximum number of opens.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <Lock className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Instant Revoke</h3>
            <p className="text-gray-600">
              Disable links immediately whenever needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
