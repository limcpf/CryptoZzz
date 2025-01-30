import { sleepSync } from "bun";
import { Client, Pool, type PoolClient } from "pg";
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";

export interface TestContext {
	container: StartedTestContainer;
	client: PoolClient;
}

export async function setupTestDB(): Promise<TestContext> {
	process.env.TESTCONTAINERS_RYUK_DISABLED = "true";

	const container = await new GenericContainer(
		"timescale/timescaledb:latest-pg13",
	)
		.withEnvironment({
			POSTGRES_PASSWORD: "testpass",
			POSTGRES_DB: "testdb",
			POSTGRES_USER: "testuser",
			POSTGRES_HOST_AUTH_METHOD: "trust",
			TS_TELEMETRY: "off",
		})
		.withWaitStrategy(
			Wait.forLogMessage(/database system is ready to accept connections/),
		)
		.withExposedPorts(5432)
		.start();

	const pool = new Pool({
		host: "localhost",
		port: container.getMappedPort(5432),
		database: "testdb",
		user: "testuser",
		password: "testpass",
	});

	sleepSync(1_500);
	const client = await pool.connect();

	return { container, client };
}

export async function teardownTestDB(ctx: TestContext) {
	await ctx.client.end();
	await ctx.container.stop();
}
