# Runbook — resume a parked run

**Contract**
- **Role:** the procedure that finishes a durable CLI run parked on an approval.
- **Mutability:** rewrite in place when the flags or the renderer's waiting text change.
- **Read when:** a run printed `Run waiting on request …` and exited 3, or a resume was refused.
- **Update when:** a durability flag, the record's file name or the parking policy changes.

**Why this file exists:** the record names the one id the operator needs, and finding it by hand
in a state directory is the step every operator gets wrong once.

---

- **Last verified:** 2026-10-24 by lead (in-process acceptance test; the two-process run is recorded in the Phase 1 report)
- **Estimated duration:** one minute per approval round
- **Risk:** low — the record is one JSON file and the settled outcome is append-only
- **Reversible:** yes — delete the record file named below

## Purpose

Finish a durable CLI run that parked on an approval, by settling its pending request from a
second process instead of leaving the run half-done.

## Use when

A run printed `Run waiting on request …` and exited **3**. It must not be used to answer a
request id that was already settled: the second settlement is refused and no effect runs.

## Preconditions

- [ ] The run was started with `--run-id`, or an earlier resume named it, or it carries a
      conversation id you can name with `--conversation`, so a record exists.
- [ ] The state directory from the first invocation is known; it defaults to `.smolagents`
      beside the working directory.
- [ ] The provider key the first invocation used is still in the environment (`HF_TOKEN` or
      `OPENAI_API_KEY`), because the resumed run finishes steps that still call the model.
- [ ] The repository is built, so `packages/cli/dist/main.js` exists (`pnpm build`).
- [ ] No other process is resuming the same run id.

## Steps

Run these from the repository root.

1. Read the request id from the record:

       node -e "const r=JSON.parse(require('node:fs').readFileSync('.smolagents/demo-1.json','utf8'));console.log(r.pending.requestId)"

   The file name is the escaped run id plus `.json`; a run id of `demo-1` is `demo-1.json`.

2. Resume and approve that request:

       node packages/cli/dist/main.js --resume demo-1 --approve <requestId> --state-dir .smolagents

   The replayed step does not call the model again and re-runs no recorded effect; it runs the
   tool the request names, then continues. If the first invocation used `--conversation <id>`
   and no `--run-id`, replace `--resume demo-1` with `--conversation <id>`: it resumes the
   newest run of that conversation.

3. If the run parks on a second request, repeat steps 1 and 2 with the new id. A run parks once
   per tool call, because a headless process has nobody to ask.

## Verification

    node -e "const r=JSON.parse(require('node:fs').readFileSync('.smolagents/demo-1.json','utf8'));console.log(r.status, (r.settlements||[]).map(s=>s.outcome).join(','))"

Expect `completed` followed by one `allowed-once` per settled request, and exit code 0 from
step 2 with a `Final answer:` line on stdout.

## Rollback

1. Delete the record: `Remove-Item .smolagents/demo-1.json` on PowerShell, or
   `rm .smolagents/demo-1.json` elsewhere.
2. Nothing else was written: the tool's own effects are the tool's, not the record's.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| exit 1, `No state directory at …` | the default `.smolagents` does not exist, or `--state-dir` names the wrong place | pass the directory the first run used |
| exit 1, `holds no record for run …` | wrong run id, or the record file was deleted | read the directory listing and use the id in the file name |
| exit 1, `Run "…" is waiting on request …` | `--approve` was omitted | rerun with `--approve <requestId>` |
| exit 1, `has no run yet` | `--conversation` named an id no record carries, and no task was passed | pass the prompt, or check the id against the record files |
| exit 1, `was already settled` | the request was approved before | nothing to do; the run is past that request |
| exit 3 again, a different request id | the run reached the next tool call | approve the new id, or stop the run by deleting its record |

## Notes

A run can also be branched instead of resumed: `--fork <parentRunId> --fork-step <n>` starts a
new record with `parentRunId`/`parentStep`, re-entering that parent step from the copied journal so
recorded effects do not run again. A fork is a new run, so it is not combined with `--resume`.

The record is written through a temporary file and a rename, so a crash during a resume leaves
the previous record authoritative; rerunning the same command is safe. `--approve` settles as
`allowed-once`: there is no sticky grant, and a resumed call whose arguments differ from the
settled digest is refused rather than run.
