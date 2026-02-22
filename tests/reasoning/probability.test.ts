import { describe, it, expect } from "vitest";
import {
  ProbabilityDistribution,
  BayesianUpdater,
  estimateTaskComplexity,
  estimateAgentCapability,
  selectAgentProbabilistic,
  type AgentCapability,
  type ConfidenceScore,
} from "@/reasoning/probability";

describe("reasoning/probability", () => {
  describe("ProbabilityDistribution", () => {
    it("normalizes probabilities to sum to 1.0", () => {
      const dist = new ProbabilityDistribution([
        { outcome: "A", probability: 2 },
        { outcome: "B", probability: 3 },
        { outcome: "C", probability: 5 },
      ]);

      const outcomes = dist.getRankedOutcomes();
      const total = outcomes.reduce((sum, o) => sum + o.probability, 0);

      expect(total).toBeCloseTo(1.0, 5);
    });

    it("returns the most likely outcome", () => {
      const dist = new ProbabilityDistribution([
        { outcome: "trivial", probability: 0.1 },
        { outcome: "moderate", probability: 0.6 },
        { outcome: "complex", probability: 0.3 },
      ]);

      expect(dist.getMostLikely()).toBe("moderate");
    });

    it("calculates entropy correctly", () => {
      // Uniform distribution has maximum entropy
      const uniform = new ProbabilityDistribution([
        { outcome: "A", probability: 1 },
        { outcome: "B", probability: 1 },
        { outcome: "C", probability: 1 },
        { outcome: "D", probability: 1 },
      ]);

      expect(uniform.entropy()).toBeCloseTo(2.0, 5); // log2(4) = 2

      // Deterministic distribution has zero entropy
      const deterministic = new ProbabilityDistribution([
        { outcome: "A", probability: 1 },
        { outcome: "B", probability: 0 },
      ]);

      expect(deterministic.entropy()).toBe(0);
    });

    it("samples outcomes according to probability", () => {
      const dist = new ProbabilityDistribution([
        { outcome: "A", probability: 0.9 },
        { outcome: "B", probability: 0.1 },
      ]);

      const samples = Array.from({ length: 100 }, () => dist.sample());
      const aCount = samples.filter((s) => s === "A").length;

      // With 90% probability, we expect ~90/100 samples to be "A"
      // Allow some variance (e.g., 75-100)
      expect(aCount).toBeGreaterThan(70);
    });

    it("returns ranked outcomes in descending probability order", () => {
      const dist = new ProbabilityDistribution([
        { outcome: "A", probability: 0.2 },
        { outcome: "B", probability: 0.5 },
        { outcome: "C", probability: 0.3 },
      ]);

      const ranked = dist.getRankedOutcomes();

      expect(ranked[0].outcome).toBe("B");
      expect(ranked[1].outcome).toBe("C");
      expect(ranked[2].outcome).toBe("A");
    });
  });

  describe("BayesianUpdater", () => {
    it("updates probability using Bayes rule", () => {
      const updater = new BayesianUpdater();

      // Prior: 50% belief
      const prior = 0.5;

      // Evidence strongly supports hypothesis
      const likelihoodIfTrue = 0.9;
      const likelihoodIfFalse = 0.2;

      const posterior = updater.update(prior, likelihoodIfTrue, likelihoodIfFalse);

      // Posterior should increase
      expect(posterior).toBeGreaterThan(prior);
      expect(posterior).toBeCloseTo(0.818, 2); // P(H|E) ≈ 0.818
    });

    it("accumulates multiple evidence sources", () => {
      const updater = new BayesianUpdater();

      const prior = 0.5;
      const evidence = [
        { likelihoodIfTrue: 0.8, likelihoodIfFalse: 0.3 },
        { likelihoodIfTrue: 0.7, likelihoodIfFalse: 0.4 },
        { likelihoodIfTrue: 0.9, likelihoodIfFalse: 0.2 },
      ];

      const posterior = updater.accumulateEvidence(prior, evidence);

      // Multiple positive evidence should increase confidence
      expect(posterior).toBeGreaterThan(0.7);
    });

    it("handles zero evidence probability gracefully", () => {
      const updater = new BayesianUpdater();

      const prior = 0.5;
      const posterior = updater.update(prior, 0, 0);

      // Should return prior unchanged
      expect(posterior).toBe(prior);
    });
  });

  describe("estimateTaskComplexity", () => {
    it("classifies trivial tasks correctly", () => {
      const dist = estimateTaskComplexity("Fix typo", []);

      expect(dist.getMostLikely()).toBe("trivial");
    });

    it("classifies simple tasks correctly", () => {
      const dist = estimateTaskComplexity(
        "Update the login button text",
        ["src/components/LoginButton.tsx"],
      );

      const mostLikely = dist.getMostLikely();
      expect(["trivial", "simple"]).toContain(mostLikely);
    });

    it("classifies moderate tasks correctly", () => {
      const dist = estimateTaskComplexity(
        "Implement user authentication with JWT tokens and session management",
        ["src/auth/login.ts", "src/auth/tokens.ts"],
      );

      const mostLikely = dist.getMostLikely();
      expect(["moderate", "complex"]).toContain(mostLikely);
    });

    it("classifies complex security tasks correctly", () => {
      const dist = estimateTaskComplexity(
        "Audit and fix all XSS vulnerabilities in the user input sanitization layer",
        [
          "src/middleware/sanitizer.ts",
          "src/middleware/validators.ts",
          "src/services/user.ts",
        ],
      );

      const mostLikely = dist.getMostLikely();
      expect(["complex", "critical"]).toContain(mostLikely);
    });

    it("increases complexity with file count", () => {
      const fewFiles = estimateTaskComplexity("Update feature", ["file1.ts"]);
      const manyFiles = estimateTaskComplexity("Update feature", [
        "file1.ts",
        "file2.ts",
        "file3.ts",
        "file4.ts",
        "file5.ts",
        "file6.ts",
        "file7.ts",
        "file8.ts",
      ]);

      expect(manyFiles.getProbability("complex")).toBeGreaterThan(
        fewFiles.getProbability("complex"),
      );
    });

    it("increases complexity with security keywords", () => {
      const regularTask = estimateTaskComplexity("Update user profile", ["user.ts"]);
      const securityTask = estimateTaskComplexity(
        "Fix authentication vulnerability and sanitize inputs",
        ["user.ts"],
      );

      expect(securityTask.getProbability("complex")).toBeGreaterThan(
        regularTask.getProbability("complex"),
      );
    });
  });

  describe("estimateAgentCapability", () => {
    const frontendAgent: AgentCapability = {
      role: "frontend",
      capabilities: ["React", "CSS", "Accessibility"],
      filePatterns: ["**/*.tsx", "**/*.jsx", "**/*.css"],
    };

    const backendAgent: AgentCapability = {
      role: "backend",
      capabilities: ["API design", "Database", "Authentication"],
      filePatterns: ["**/api/**", "**/services/**", "**/db/**"],
    };

    it("assigns high confidence for well-matched agent", () => {
      const confidence = estimateAgentCapability(
        frontendAgent,
        "Update the React component styling with new CSS",
        ["src/components/Header.tsx", "src/styles/header.css"],
      );

      expect(confidence.value).toBeGreaterThan(0.7);
    });

    it("assigns low confidence for poorly-matched agent", () => {
      const confidence = estimateAgentCapability(
        backendAgent,
        "Update the React component styling",
        ["src/components/Header.tsx"],
      );

      expect(confidence.value).toBeLessThan(0.6);
    });

    it("increases confidence with capability keyword match", () => {
      const confidence = estimateAgentCapability(
        backendAgent,
        "Design a new REST API endpoint for user authentication",
        ["src/api/auth.ts"],
      );

      expect(confidence.value).toBeGreaterThan(0.7);
      expect(confidence.sources).toContain(
        expect.stringContaining("capability-match"),
      );
    });

    it("increases confidence with file pattern match", () => {
      const confidence = estimateAgentCapability(
        frontendAgent,
        "Update component",
        ["src/components/Button.tsx", "src/components/Form.tsx"],
      );

      expect(confidence.value).toBeGreaterThan(0.6);
      expect(confidence.sources.some((s) => s.startsWith("file-match"))).toBe(
        true,
      );
    });

    it("records evidence sources", () => {
      const confidence = estimateAgentCapability(
        frontendAgent,
        "Improve React component accessibility",
        ["src/components/Modal.tsx"],
      );

      expect(confidence.sources.length).toBeGreaterThan(0);
    });
  });

  describe("selectAgentProbabilistic", () => {
    const agents: AgentCapability[] = [
      {
        role: "frontend",
        capabilities: ["React", "CSS"],
        filePatterns: ["**/*.tsx", "**/*.css"],
      },
      {
        role: "backend",
        capabilities: ["API", "Database"],
        filePatterns: ["**/api/**", "**/db/**"],
      },
      {
        role: "security",
        capabilities: ["Authentication", "Vulnerability scanning"],
        filePatterns: ["**/auth/**", "**/security/**"],
      },
    ];

    it("selects frontend agent for UI tasks", () => {
      const { agent, confidence } = selectAgentProbabilistic(
        agents,
        "Update the React component styles",
        ["src/components/Header.tsx"],
      );

      expect(agent.role).toBe("frontend");
      expect(confidence.value).toBeGreaterThan(0.5);
    });

    it("selects backend agent for API tasks", () => {
      const { agent, confidence } = selectAgentProbabilistic(
        agents,
        "Create a new database query for user lookup",
        ["src/db/users.ts"],
      );

      expect(agent.role).toBe("backend");
      expect(confidence.value).toBeGreaterThan(0.5);
    });

    it("selects security agent for security tasks", () => {
      const { agent, confidence } = selectAgentProbabilistic(
        agents,
        "Fix authentication vulnerability in login flow",
        ["src/auth/login.ts"],
      );

      expect(agent.role).toBe("security");
      expect(confidence.value).toBeGreaterThan(0.5);
    });

    it("returns agent with highest confidence", () => {
      const { agent, confidence } = selectAgentProbabilistic(
        agents,
        "Update user profile API endpoint",
        ["src/api/users.ts"],
      );

      // Should select backend agent
      expect(agent.role).toBe("backend");
    });
  });
});
