'use strict';

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const PROJECT_ID = 'zyphe-af0bf';
const REGION = 'us-central1';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const WORKFLOW_NAME = `projects/${PROJECT_ID}/locations/${REGION}/workflows/property-pipeline`;

// CORS helper
function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── Step order ───────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  'discover',
  'property_data',
  'asset_secure',
  'intel',
  'orientation',
  'context_graph',
  'buyer_dna',
  'smoke',
  'report',
];

// Batch collection map
const STEP_COLLECTION = {
  property_data: 'property_data_batch_jobs',
  asset_secure: 'asset_secure_batch_jobs',
  intel: 'full_intel_batch_jobs',
  orientation: 'orientation_batch_jobs',
  context_graph: 'context_graph_batch_jobs',
  buyer_dna: 'buyer_dna_batch_jobs',
};

// Required analysis docs per zpid
const REQUIRED_ANALYSIS_TYPES = ['visual', 'assets', 'investment'];

// ─── Internal: discover zpids missing analysis ─────────────────────────────
async function discoverIncompleteZpids(city, state) {
  const db = admin.firestore();

  // Query properties collection for the given city
  const snapshot = await db
    .collection('properties')
    .where('city', '==', city)
    .get();

  if (snapshot.empty) {
    return { zpids: [], totalFound: 0, alreadyComplete: 0 };
  }

  const allZpids = snapshot.docs.map((d) => d.id);
  const totalFound = allZpids.length;
  const incomplete = [];

  // Check in chunks of 10
  const chunkSize = 10;
  for (let i = 0; i < allZpids.length; i += chunkSize) {
    const chunk = allZpids.slice(i, i + chunkSize);

    // Build refs for analysis subcollections + context_graph
    const refsToCheck = [];
    for (const zpid of chunk) {
      for (const analysisType of REQUIRED_ANALYSIS_TYPES) {
        refsToCheck.push(
          db.collection('properties').doc(zpid).collection('analysis').doc(analysisType)
        );
      }
      refsToCheck.push(db.collection('context_graph').doc(zpid));
    }

    const snaps = await db.getAll(...refsToCheck);

    // Map results back per zpid
    const requiredPerZpid = REQUIRED_ANALYSIS_TYPES.length + 1; // analysis docs + context_graph
    for (let j = 0; j < chunk.length; j++) {
      const zpid = chunk[j];
      const offset = j * requiredPerZpid;
      const zpidSnaps = snaps.slice(offset, offset + requiredPerZpid);
      const allExist = zpidSnaps.every((s) => s.exists);
      if (!allExist) {
        incomplete.push(zpid);
      }
    }
  }

  const alreadyComplete = totalFound - incomplete.length;
  return { zpids: incomplete, totalFound, alreadyComplete };
}

// ─── 1. pipelineDiscover ──────────────────────────────────────────────────────
const pipelineDiscover = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { city, state, runId } = req.body || {};
    if (!city || !state) {
      res.status(400).json({ error: 'city and state are required' });
      return;
    }

    const result = await discoverIncompleteZpids(city, state);

    // Optionally update the pipeline run
    if (runId) {
      await admin
        .firestore()
        .collection('pipeline_runs')
        .doc(runId)
        .set(
          {
            zpids: result.zpids,
            'steps.discover': {
              status: 'done',
              zpidsFound: result.zpids.length,
              durationMs: 0,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    res.json(result);
  } catch (e) {
    console.error('[pipelineDiscover]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 2. pipelineCreateBatchJob ────────────────────────────────────────────────
const pipelineCreateBatchJob = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { collection, zpids, runId, stepName, options } = req.body || {};
    if (!collection || !zpids || !stepName) {
      res.status(400).json({ error: 'collection, zpids, and stepName are required' });
      return;
    }

    const jobId = `pipeline_${stepName}_${Date.now()}`;
    const db = admin.firestore();

    await db
      .collection(collection)
      .doc(jobId)
      .set({
        zpids,
        status: 'queued',
        total: zpids.length,
        done: 0,
        failed: 0,
        skipped: 0,
        results: {},
        pipelineRunId: runId || null,
        pipelineStep: stepName,
        ...(options ? { options } : {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json({ jobId });
  } catch (e) {
    console.error('[pipelineCreateBatchJob]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 3. pipelinePollBatch ─────────────────────────────────────────────────────
const pipelinePollBatch = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { collection, jobId } = req.body || {};
    if (!collection || !jobId) {
      res.status(400).json({ error: 'collection and jobId are required' });
      return;
    }

    const snap = await admin.firestore().collection(collection).doc(jobId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const data = snap.data();
    res.json({
      status: data.status || 'queued',
      done: data.done || 0,
      failed: data.failed || 0,
      skipped: data.skipped || 0,
      total: data.total || 0,
      results: data.results || {},
    });
  } catch (e) {
    console.error('[pipelinePollBatch]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 4. pipelineUpdateRun ─────────────────────────────────────────────────────
const pipelineUpdateRun = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { runId, step, data } = req.body || {};
    if (!runId || !step || !data) {
      res.status(400).json({ error: 'runId, step, and data are required' });
      return;
    }

    const updatePayload = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Merge step data under steps.{step}
    const stepData = { ...data };
    // If top-level status is provided, apply it at run level and remove from step data
    if (stepData.status !== undefined && PIPELINE_STEPS.indexOf(step) === -1) {
      // It's a top-level status update
      updatePayload.status = stepData.status;
      delete stepData.status;
    }

    // Write step fields
    for (const [key, value] of Object.entries(stepData)) {
      updatePayload[`steps.${step}.${key}`] = value;
    }

    // If the step data itself has a status, also record it
    if (data.status !== undefined) {
      updatePayload[`steps.${step}.status`] = data.status;
    }

    await admin
      .firestore()
      .collection('pipeline_runs')
      .doc(runId)
      .set(updatePayload, { merge: true });

    res.json({ ok: true });
  } catch (e) {
    console.error('[pipelineUpdateRun]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 5. pipelineSmokeCheck ────────────────────────────────────────────────────
const pipelineSmokeCheck = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { zpids, runId } = req.body || {};
    if (!zpids || !Array.isArray(zpids)) {
      res.status(400).json({ error: 'zpids array is required' });
      return;
    }

    const db = admin.firestore();
    const passed = [];
    const failed = [];
    const details = {};

    const chunkSize = 20;
    for (let i = 0; i < zpids.length; i += chunkSize) {
      const chunk = zpids.slice(i, i + chunkSize);

      const refsToCheck = [];
      for (const zpid of chunk) {
        refsToCheck.push(db.collection('properties').doc(zpid));
        refsToCheck.push(
          db.collection('properties').doc(zpid).collection('analysis').doc('visual')
        );
        refsToCheck.push(
          db.collection('properties').doc(zpid).collection('analysis').doc('assets')
        );
        refsToCheck.push(db.collection('context_graph').doc(zpid));
      }

      const snaps = await db.getAll(...refsToCheck);

      const docsPerZpid = 4; // root + visual + assets + context_graph
      for (let j = 0; j < chunk.length; j++) {
        const zpid = chunk[j];
        const offset = j * docsPerZpid;
        const [rootSnap, visualSnap, assetsSnap, cgSnap] = snaps.slice(
          offset,
          offset + docsPerZpid
        );

        const missing = [];
        if (!rootSnap.exists) missing.push('properties root doc');
        if (!visualSnap.exists) missing.push('analysis/visual');
        if (!assetsSnap.exists) missing.push('analysis/assets');
        if (!cgSnap.exists) {
          missing.push('context_graph doc');
        } else {
          const cgData = cgSnap.data();
          if (!cgData.factors || cgData.factors.length === 0) {
            missing.push('context_graph factors empty');
          }
        }

        if (missing.length === 0) {
          passed.push(zpid);
        } else {
          failed.push(zpid);
          details[zpid] = missing;
        }
      }
    }

    // Update pipeline run if provided
    if (runId) {
      await db
        .collection('pipeline_runs')
        .doc(runId)
        .set(
          {
            'steps.smoke': {
              status: failed.length === 0 ? 'done' : 'failed',
              total: zpids.length,
              passed: passed.length,
              failed: failed.length,
              failedZpids: failed,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    res.json({ passed, failed, details });
  } catch (e) {
    console.error('[pipelineSmokeCheck]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 6. pipelineTrigger (callable) ───────────────────────────────────────────
const pipelineTrigger = functions.https.onCall(async (data, context) => {
  const { city, state, zpids: providedZpids, runId: providedRunId } = data || {};

  if (!city || !state) {
    throw new functions.https.HttpsError('invalid-argument', 'city and state are required');
  }

  const runId = providedRunId || `pipeline_${Date.now()}`;
  const db = admin.firestore();
  const triggeredBy = context.auth ? context.auth.uid : 'anonymous';

  // Discover zpids if not provided
  let zpids = providedZpids;
  if (!zpids || zpids.length === 0) {
    const discovered = await discoverIncompleteZpids(city, state);
    zpids = discovered.zpids;
  }

  // Build initial step state
  const initialSteps = {};
  for (const step of PIPELINE_STEPS) {
    if (step === 'discover') {
      initialSteps[step] = { status: 'done', zpidsFound: zpids.length, durationMs: 0 };
    } else if (step === 'smoke') {
      initialSteps[step] = { status: 'pending', total: 0, passed: 0, failed: 0, failedZpids: [] };
    } else if (step === 'report') {
      initialSteps[step] = { status: 'pending' };
    } else {
      initialSteps[step] = {
        status: 'pending',
        batchJobId: '',
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        retriedFailed: 0,
        durationMs: 0,
      };
    }
  }

  // Create pipeline run doc
  await db
    .collection('pipeline_runs')
    .doc(runId)
    .set({
      runId,
      city,
      state,
      status: 'queued',
      triggeredBy,
      workflowExecutionName: '',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      zpids,
      steps: initialSteps,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Trigger Cloud Workflow
  let executionName = '';
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token || tokenResponse;

    const workflowUrl = `https://workflowexecutions.googleapis.com/v1/${WORKFLOW_NAME}/executions`;
    const body = {
      argument: JSON.stringify({
        runId,
        city,
        state,
        zpids,
        projectId: PROJECT_ID,
        region: REGION,
        baseUrl: BASE_URL,
      }),
    };

    const fetchRes = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      throw new Error(`Workflow API error ${fetchRes.status}: ${errText}`);
    }

    const execution = await fetchRes.json();
    executionName = execution.name || '';

    // Save execution name
    await db
      .collection('pipeline_runs')
      .doc(runId)
      .set(
        {
          workflowExecutionName: executionName,
          status: 'running',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (workflowErr) {
    console.error('[pipelineTrigger] Failed to start workflow:', workflowErr);
    // Mark run as failed but still return runId so caller can investigate
    await db
      .collection('pipeline_runs')
      .doc(runId)
      .set(
        {
          status: 'failed',
          workflowError: workflowErr.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    throw new functions.https.HttpsError('internal', workflowErr.message);
  }

  return { runId, executionName };
});

module.exports = {
  pipelineDiscover,
  pipelineCreateBatchJob,
  pipelinePollBatch,
  pipelineUpdateRun,
  pipelineSmokeCheck,
  pipelineTrigger,
};
