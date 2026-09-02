import { VercelRequest, VercelResponse } from '@vercel/node';
import { JobOrchestrator } from '../src/orchestrator/JobOrchestrator';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input } = req.body;
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "input" field' });
  }

  try {
    const orchestrator = JobOrchestrator.getInstance();
    const workflow = orchestrator.createWorkflow(input);
    workflow.steps[0].input = input;
    const sceneGraph = await orchestrator.execute(workflow.id);
    res.status(200).json(sceneGraph);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}