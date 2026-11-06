import unittest
from unittest.mock import patch

import scan


PAY_A = "0x" + "a" * 40
PAY_B = "0x" + "b" * 40
WALLET_1 = "0x" + "1" * 40
WALLET_2 = "0x" + "2" * 40


def item(pay_to, resource="/uk-company", description="company data"):
    return {
        "resource": resource,
        "description": description,
        "quality": {"l30DaysTotalCalls": 10, "l30DaysUniquePayers": 2},
        "accepts": [{"network": "base", "asset": scan.USDC, "payTo": pay_to}],
    }


def transfer(wallet, amount="0xf4240"):
    return {
        "topics": [scan.TRANSFER, "0x" + "0" * 24 + wallet[2:], "0x" + "0" * 64],
        "data": amount,
    }


class OnchainCoverageTests(unittest.TestCase):
    def run_scan(self, items, head, outcomes, blocks):
        calls = []

        def fake_rpc(method, params):
            if method == "eth_blockNumber":
                return hex(head)
            start = int(params[0]["fromBlock"], 16)
            end = int(params[0]["toBlock"], 16)
            calls.append((start, end))
            outcome = outcomes.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        with patch.object(scan, "bazaar", return_value=items), \
                patch.object(scan, "rpc", side_effect=fake_rpc), \
                patch.object(scan.time, "sleep"):
            result = scan.onchain(blocks, 25)
        return result, calls

    def test_successful_empty_and_total_failure_have_distinct_coverage(self):
        (_, market_empty), _ = self.run_scan([item(PAY_A)], 5, [[]], 1)
        (_, market_failed), _ = self.run_scan([item(PAY_A)], 5, [RuntimeError("offline")], 1)
        self.assertEqual(market_empty[0]["coverage"], {
            "from_block": 5, "to_block": 5, "complete": True,
            "completed_ranges": [{"from_block": 5, "to_block": 5}],
            "failed_ranges": [],
        })
        self.assertFalse(market_failed[0]["coverage"]["complete"])
        self.assertEqual(market_failed[0]["coverage"]["completed_ranges"], [])
        self.assertEqual(market_failed[0]["coverage"]["failed_ranges"], [
            {"from_block": 5, "to_block": 5, "error": "offline"},
        ])

    def test_partial_coverage_excludes_entire_recipient(self):
        logs = [transfer(WALLET_1), transfer(WALLET_1), transfer(WALLET_1)]
        (leads, market), _ = self.run_scan(
            [item(PAY_A)], 10000, [logs, RuntimeError("range failed")], 10001,
        )
        self.assertEqual(leads, [])
        self.assertFalse(market[0]["coverage"]["complete"])
        self.assertEqual(market[0]["coverage"]["completed_ranges"], [
            {"from_block": 0, "to_block": 9999},
        ])

    def test_payto_failures_are_independent(self):
        logs = [transfer(WALLET_1), transfer(WALLET_1), transfer(WALLET_1)]
        (leads, market), _ = self.run_scan(
            [item(PAY_A), item(PAY_B)], 5,
            [RuntimeError("bad payTo"), logs], 1,
        )
        self.assertEqual([lead["id"] for lead in leads], [WALLET_1])
        self.assertEqual([row["payTo"] for row in market], [PAY_A, PAY_B])
        self.assertFalse(market[0]["coverage"]["complete"])
        self.assertTrue(market[1]["coverage"]["complete"])

    def test_fully_covered_lead_counts_are_preserved(self):
        logs = [transfer(WALLET_1), transfer(WALLET_1), transfer(WALLET_1)]
        (leads, _), _ = self.run_scan([item(PAY_A)], 5, [logs], 1)
        self.assertEqual(len(leads), 1)
        self.assertIn("3 payments", leads[0]["title"])
        self.assertIn("$3.00 USDC", leads[0]["title"])

    def test_shared_payto_is_deduplicated(self):
        duplicate = item(PAY_A, "/another-resource", "other data")
        (leads, market), calls = self.run_scan(
            [item(PAY_A), duplicate], 5,
            [[transfer(WALLET_1), transfer(WALLET_1), transfer(WALLET_1)]], 1,
        )
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(market), 1)
        self.assertEqual(market[0]["resource"], "/uk-company")
        self.assertEqual(len(leads), 1)

    def test_exact_window_chunking_and_genesis_ranges(self):
        (_, market), calls = self.run_scan([item(PAY_A)], 10000, [[], []], 10000)
        self.assertEqual(calls, [(1, 10000)])
        self.assertEqual(market[0]["coverage"]["from_block"], 1)

        (_, market), calls = self.run_scan([item(PAY_A)], 10000, [[], []], 10001)
        self.assertEqual(calls, [(0, 9999), (10000, 10000)])
        self.assertEqual(market[0]["coverage"]["from_block"], 0)
        self.assertEqual(market[0]["coverage"]["to_block"], 10000)

        (_, market), calls = self.run_scan([item(PAY_A)], 3, [[], []], 10)
        self.assertEqual(calls, [(0, 3)])
        self.assertEqual(market[0]["coverage"]["from_block"], 0)
        self.assertEqual(market[0]["coverage"]["to_block"], 3)

    def test_invalid_blocks_rejected_before_network(self):
        for blocks in (0, -1):
            with self.subTest(blocks=blocks), \
                    patch.object(scan, "bazaar", side_effect=AssertionError("network")), \
                    patch.object(scan, "rpc", side_effect=AssertionError("network")):
                with self.assertRaises(ValueError):
                    scan.onchain(blocks, 25)


if __name__ == "__main__":
    unittest.main()
