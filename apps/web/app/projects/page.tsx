"use client";

import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  async function loadProjects() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/projects");

      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load projects");
      }

      setProjects(result.projects);
    } catch (error) {
      console.error(error);
      setError("Could not load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function deleteProject(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();

        throw new Error(
          result.error || "Failed to delete project",
        );
      }

      await loadProjects();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Could not delete project.",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-zinc-500">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Projects
          </h2>

          <p className="mt-2 text-zinc-400">
            Organize your tracked activity by project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          + New Project
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <div className="text-4xl">📁</div>

          <h3 className="mt-4 text-lg font-semibold">
            No projects yet
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Create your first project to organize your activity.
          </p>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Create project
          </button>
        </div>
      ) : (
        /* Project grid */
        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => deleteProject(project.id)}
              onUpdated={loadProjects}
            />
          ))}
        </section>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadProjects();
          }}
        />
      )}
    </div>
  );
}


function ProjectCard({
  project,
  onDelete,
  onUpdated,
}: {
  project: Project;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-700">
      {/* Icon */}
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800 text-xl">
          📁
        </div>

        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
            title="Edit project"
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            title="Delete project"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Information */}
      <div className="mt-5">
        <h3 className="text-lg font-semibold">
          {project.name}
        </h3>

        <p className="mt-2 min-h-10 text-sm leading-5 text-zinc-500">
          {project.description || "No description provided."}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-600">
          Created{" "}
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>

      {editing && (
        <EditProjectModal
          project={project}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createProject() {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to create project",
        );
      }

      onCreated();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Could not create project.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal>
      <h3 className="text-xl font-semibold">
        Create project
      </h3>

      <p className="mt-1 text-sm text-zinc-500">
        Create a project to associate with tracked activity.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-zinc-400">
            Project name
          </span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. FocusTrace Development"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-zinc-400">
            Description
          </span>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            rows={3}
            placeholder="What are you working on?"
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={createProject}
          disabled={saving}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create project"}
        </button>
      </div>
    </Modal>
  );
}

function EditProjectModal({
  project,
  onClose,
  onUpdated,
}: {
  project: Project;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(
    project.description ?? "",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateProject() {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/projects/${project.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update project",
        );
      }

      onUpdated();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Could not update project.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal>
      <h3 className="text-xl font-semibold">
        Edit project
      </h3>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-zinc-400">
            Project name
          </span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-zinc-400">
            Description
          </span>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={updateProject}
          disabled={saving}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}


function Modal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}