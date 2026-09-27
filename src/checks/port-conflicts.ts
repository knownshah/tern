import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';
import { findProcessOnPort, type PortProcess } from '../utils/ports.js';

export const portConflictsCheck: CheckDefinition = {
  id: 'port-conflicts',
  name: 'Port Conflicts Check',
  category: 'port',
  description: 'Checks common development ports for active processes or conflicts',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const portsToCheck = context.config?.ports || [3000, 5173, 8080, 8000, 4000, 5000];

    // Scan scripts in package.json to see if a specific port is used
    if (context.pkg?.scripts) {
      const scriptStr = JSON.stringify(context.pkg.scripts);
      const portMatches = scriptStr.match(/(?:-p|--port|PORT=)\s*(\d{4,5})/g);
      if (portMatches) {
        for (const m of portMatches) {
          const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
          if (num && !portsToCheck.includes(num)) {
            portsToCheck.push(num);
          }
        }
      }
    }

    const occupied: PortProcess[] = [];

    // Check up to 5 common ports
    const limitedPorts = portsToCheck.slice(0, 8);
    for (const port of limitedPorts) {
      try {
        const proc = await findProcessOnPort(port);
        if (proc) {
          occupied.push(proc);
        }
      } catch {
        // Ignore check failure
      }
    }

    if (occupied.length > 0) {
      const details = occupied.map((p) => `Port ${p.port}: In use by ${p.name} (PID: ${p.pid})`);
      return {
        id: 'port-conflicts',
        name: 'Port Conflicts Check',
        category: 'port',
        status: 'warning',
        message: `${occupied.length} common dev port(s) in use (${occupied.map((p) => p.port).join(', ')})`,
        details,
        fixable: false,
        hint: `Use 'tern port <number>' to inspect or terminate processes occupying the port.`,
      };
    }

    return {
      id: 'port-conflicts',
      name: 'Port Conflicts Check',
      category: 'port',
      status: 'success',
      message: `Common development ports are free (${limitedPorts.slice(0, 4).join(', ')})`,
      fixable: false,
    };
  },
};
