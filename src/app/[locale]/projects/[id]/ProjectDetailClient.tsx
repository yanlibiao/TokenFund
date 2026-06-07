"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatTokenCount } from "@/lib/token-utils";
import AgentSandbox from "@/components/projects/AgentSandbox";

type ProjectData = any;

export default function ProjectDetailClient({
  project,
  locale,
  categoryName,
  statusLabel,
  progressPct,
}: {
  project: ProjectData;
  locale: string;
  categoryName: string;
  statusLabel: string;
  progressPct: number;
}) {
  const t = useTranslations("project");
  const [contributeOpen, setContributeOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleContribute = async () => {
    if (!amount || parseInt(amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          amount: parseInt(amount),
          message: message || null,
        }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-text-dim">{categoryName}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded border status-${project.status.toLowerCase()}`}
            >
              {statusLabel}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-accent glow-text">
            {project.title}
          </h1>
          <p className="text-text-dim text-sm mt-1">
            {t("created by")}{" "}
            <Link
              href={`/${locale}/profile/${project.creator.username}`}
              className="text-text-secondary hover:text-accent"
            >
              @{project.creator.username}
            </Link>
          </p>
        </div>
        {(project.status === "FUNDING" || project.status === "IN_PROGRESS") && (
          <button
            onClick={() => setContributeOpen(true)}
            className="btn btn-primary"
          >
            {t("contribute")}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="terminal-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-primary">{t("fundingProgress")}</span>
          <span className="text-sm text-accent font-semibold">
            {Math.round(progressPct)}%
          </span>
        </div>
        <div className="token-progress mb-3">
          <div
            className="token-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-primary font-semibold">
            {formatTokenCount(project.tokenRaised)} /{" "}
            {formatTokenCount(project.tokenGoal)} tokens
          </span>
          <span className="text-text-dim">
            {project._count.contributions} {t("backers")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <div className="terminal-card p-6">
            <p className="text-text-secondary text-sm">{project.summary}</p>
          </div>

          {/* Description */}
          <div className="terminal-card p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              <span className="text-text-dim">## </span>
              {t("description")}
            </h2>
            <div className="markdown-body text-sm">
              <pre className="whitespace-pre-wrap font-mono text-text-secondary bg-transparent p-0 border-0">
                {project.description}
              </pre>
            </div>
          </div>

          {/* Agent Sandbox — always visible */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              <span className="text-text-dim">## </span>
              {locale === "zh" ? "AI Agent 沙盒" : "AI Agent Sandbox"}
            </h2>
            <AgentSandbox
              projectId={project.id}
              provider={project.llmProvider}
              model={project.llmModel}
              tokenRaised={project.tokenRaised}
              tokenGoal={project.tokenGoal}
              projectStatus={project.status}
              locale={locale}
            />
          </div>

          {/* Deliverables */}
          <div className="terminal-card p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              <span className="text-text-dim">## </span>
              {t("deliverables")}
            </h2>
            {project.deliverables.length > 0 ? (
              <div className="space-y-3">
                {project.deliverables.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 border border-border-color rounded"
                  >
                    <div>
                      <p className="text-text-primary text-sm">{d.title}</p>
                      <p className="text-text-dim text-xs">
                        v{d.version} · {d.downloadCount} {t("downloads")}
                      </p>
                    </div>
                    <a
                      href={d.fileUrl}
                      className="btn btn-secondary text-xs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("download")}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-dim text-sm">{t("noDeliverables")}</p>
            )}
          </div>

          {/* Discussion */}
          <div className="terminal-card p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              <span className="text-text-dim">## </span>
              {t("discussion")} ({project._count.comments})
            </h2>
            {project.comments.length > 0 ? (
              <div className="space-y-4">
                {project.comments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="border border-border-color rounded p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-accent text-xs font-semibold">
                        @{comment.user.username}
                      </span>
                      <span className="text-text-dim text-xs">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm">
                      {comment.content}
                    </p>
                    {/* Replies */}
                    {comment.replies?.map((reply: any) => (
                      <div
                        key={reply.id}
                        className="ml-4 mt-2 border-l-2 border-border-color pl-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-accent text-xs font-semibold">
                            @{reply.user.username}
                          </span>
                        </div>
                        <p className="text-text-secondary text-xs">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-dim text-sm">No comments yet.</p>
            )}

            {/* Add comment form */}
            <div className="mt-4 pt-4 border-t border-border-color">
              <textarea
                className="w-full text-sm min-h-[80px]"
                placeholder={t("addComment") + "..."}
              />
              <button className="btn btn-secondary text-xs mt-2">
                {t("addComment")}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Creator info */}
          <div className="terminal-card p-4">
            <h3 className="text-xs text-text-dim mb-3 uppercase tracking-wider">
              Creator
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-bg-tertiary border border-border-color flex items-center justify-center text-accent text-lg font-bold">
                {project.creator.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-text-primary text-sm font-semibold">
                  @{project.creator.username}
                </p>
                {project.creator.githubHandle && (
                  <p className="text-text-dim text-xs">
                    github.com/{project.creator.githubHandle}
                  </p>
                )}
              </div>
            </div>
            {project.creator.bio && (
              <p className="text-text-secondary text-xs mt-3">
                {project.creator.bio}
              </p>
            )}
          </div>

          {/* Project info */}
          <div className="terminal-card p-4">
            <h3 className="text-xs text-text-dim mb-3 uppercase tracking-wider">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-dim">Provider</dt>
                <dd className="text-text-primary">{project.llmProvider}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-dim">Model</dt>
                <dd className="text-text-primary">{project.llmModel}</dd>
              </div>
              {project.repoUrl && (
                <div className="flex justify-between">
                  <dt className="text-text-dim">Repo</dt>
                  <dd>
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-xs hover:underline"
                    >
                      GitHub ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Contributors */}
          <div className="terminal-card p-4">
            <h3 className="text-xs text-text-dim mb-3 uppercase tracking-wider">
              {t("contributors")} ({project.contributions.length})
            </h3>
            {project.contributions.length > 0 ? (
              <div className="space-y-2">
                {project.contributions.slice(0, 10).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-text-secondary">
                      @{c.user.username}
                    </span>
                    <span className="text-accent text-xs font-semibold">
                      +{formatTokenCount(c.amount)}
                    </span>
                  </div>
                ))}
                {project.contributions.length > 10 && (
                  <p className="text-text-dim text-xs">
                    +{project.contributions.length - 10} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-text-dim text-xs">No contributions yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Contribute Modal */}
      {contributeOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="terminal-card p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-accent mb-4">
              &gt; {t("contribute")}
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              {t("contributeDescription")}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-dim mb-1">
                  {t("amount")}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full"
                  placeholder="10000"
                  min="100"
                />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">
                  {t("message")}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full min-h-[60px]"
                  placeholder="Good luck with the project!"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleContribute}
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? "..." : t("submitContribution")}
                </button>
                <button
                  onClick={() => setContributeOpen(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
