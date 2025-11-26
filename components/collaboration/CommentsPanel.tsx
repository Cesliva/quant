"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { MessageSquare, Send, X, Trash2 } from "lucide-react";
import { subscribeToCollection, createDocument, deleteDocument } from "@/lib/firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { serverTimestamp, where } from "firebase/firestore";
import { logActivity } from "@/lib/utils/activityLogger";

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  section?: string;
  lineId?: string;
  createdAt: any;
  editedAt?: any;
}

interface CommentsPanelProps {
  projectId: string | null;
  section?: string;
  lineId?: string;
  className?: string;
}

export function CommentsPanel({ projectId, section, lineId, className = "" }: CommentsPanelProps) {
  const companyId = useCompanyId();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load comments
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId) {
      return;
    }

    // Use base comments collection path (odd number of segments)
    const commentsPath = `companies/${companyId}/projects/${projectId}/comments`;
    
    // Build query constraints to filter by section/lineId
    const constraints = [];
    if (lineId) {
      constraints.push(where("lineId", "==", lineId));
    } else if (section) {
      constraints.push(where("section", "==", section));
    }
    // For general comments (no section/lineId), we'll filter in the callback

    const unsubscribe = subscribeToCollection<Comment>(
      commentsPath,
      (data) => {
        // Filter data based on section/lineId if needed
        let filtered = data;
        if (!lineId && !section) {
          // General comments: no section and no lineId
          filtered = data.filter(c => !c.section && !c.lineId);
        }
        
        const sorted = filtered.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return aTime - bTime;
        });
        setComments(sorted);
        // Scroll to bottom when new comments arrive
        setTimeout(() => {
          commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      constraints
    );

    return () => unsubscribe();
  }, [projectId, companyId, section, lineId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !projectId || !companyId || !user) return;

    setIsSubmitting(true);
    try {
      // Use base comments collection path (odd number of segments)
      const commentsPath = `companies/${companyId}/projects/${projectId}/comments`;

      await createDocument(commentsPath, {
        userId: user.uid,
        userName: user.displayName || user.email || "Unknown User",
        userAvatar: user.photoURL || undefined,
        text: newComment.trim(),
        section: section || null,
        lineId: lineId || null,
        createdAt: serverTimestamp(),
      });

      // Log activity
      await logActivity(companyId, projectId, "added_comment", {
        section,
        lineId,
      });

      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      alert("Failed to add comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    if (!projectId || !companyId) return;

    try {
      // Use base comments collection path (odd number of segments)
      const commentsPath = `companies/${companyId}/projects/${projectId}/comments`;

      await deleteDocument(commentsPath, commentId);
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("Failed to delete comment. Please try again.");
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "Just now";
    
    const time = timestamp.toMillis ? timestamp.toMillis() : timestamp;
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleString();
  };

  const getUserInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!projectId) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4" />
          Comments
          {section && <span className="text-xs text-gray-500">({section})</span>}
          {lineId && <span className="text-xs text-gray-500">(Line {lineId})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {comment.userAvatar ? (
                    <img
                      src={comment.userAvatar}
                      alt={comment.userName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <span className="text-xs font-medium text-blue-600">
                      {getUserInitials(comment.userName)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">
                      {comment.userName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                    {comment.text}
                  </p>
                </div>
                {comment.userId === user?.uid && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Add Comment Form */}
        <form onSubmit={handleSubmitComment} className="space-y-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!newComment.trim() || isSubmitting}
            className="w-full"
          >
            <Send className="w-3 h-3 mr-2" />
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

