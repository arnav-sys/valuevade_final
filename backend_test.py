import requests
import sys
import json
from datetime import datetime

class ValuevadeAPITester:
    def __init__(self, base_url="https://finance-copilot-32.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.test_referral_code = None  # Store referral code for testing

    def run_test(self, name, method, endpoint, expected_status, data=None, expected_fields=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)}")
            except:
                print(f"   Response (text): {response.text}")

            if success:
                # Check expected fields if provided
                if expected_fields and response_data:
                    for field in expected_fields:
                        if field not in response_data:
                            success = False
                            print(f"   ❌ Missing expected field: {field}")
                            break
                
                if success:
                    self.tests_passed += 1
                    print(f"   ✅ Passed")
                    self.test_results.append({
                        "test": name,
                        "status": "PASSED",
                        "response": response_data
                    })
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.test_results.append({
                    "test": name,
                    "status": "FAILED",
                    "expected_status": expected_status,
                    "actual_status": response.status_code,
                    "response": response_data
                })

            return success, response_data

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "status": "ERROR",
                "error": str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200,
            expected_fields=["message"]
        )

    def test_waitlist_count(self):
        """Test getting waitlist count"""
        return self.run_test(
            "Get Waitlist Count",
            "GET",
            "api/waitlist/count",
            200,
            expected_fields=["count"]
        )

    def test_join_waitlist_valid(self):
        """Test joining waitlist with valid data"""
        test_data = {
            "first_name": f"Test_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        }
        
        success, response = self.run_test(
            "Join Waitlist (Valid Data)",
            "POST",
            "api/waitlist",
            200,
            data=test_data,
            expected_fields=["id", "first_name", "email", "position", "timestamp", "referral_code", "referral_count"]
        )
        
        if success and response:
            # Verify position is in expected range
            position = response.get("position", 0)
            if 200 <= position <= 350:
                print(f"   ✅ Position {position} is in expected range (200-350)")
            else:
                print(f"   ⚠️  Position {position} is outside expected range (200-350)")
            
            # Verify referral_code is 6 characters alphanumeric
            referral_code = response.get("referral_code", "")
            if len(referral_code) == 6 and referral_code.isalnum():
                print(f"   ✅ Referral code {referral_code} is valid 6-char alphanumeric")
                self.test_referral_code = referral_code  # Store for later tests
            else:
                print(f"   ⚠️  Referral code {referral_code} is not valid 6-char alphanumeric")
            
            # Verify referral_count starts at 0
            referral_count = response.get("referral_count", -1)
            if referral_count == 0:
                print(f"   ✅ Referral count starts at 0")
            else:
                print(f"   ⚠️  Referral count is {referral_count}, expected 0")
        
        return success, response

    def test_join_waitlist_duplicate(self):
        """Test joining waitlist with duplicate email"""
        # First, join with a specific email
        test_data = {
            "first_name": "Duplicate",
            "email": "duplicate@example.com"
        }
        
        # Join first time
        self.run_test(
            "Join Waitlist (First Time)",
            "POST",
            "api/waitlist",
            200,
            data=test_data
        )
        
        # Join second time with same email
        return self.run_test(
            "Join Waitlist (Duplicate Email)",
            "POST",
            "api/waitlist",
            200,
            data=test_data,
            expected_fields=["id", "first_name", "email", "position", "timestamp", "referral_code", "referral_count"]
        )

    def test_join_waitlist_invalid(self):
        """Test joining waitlist with invalid data"""
        # Test missing fields
        success1, _ = self.run_test(
            "Join Waitlist (Missing Fields)",
            "POST",
            "api/waitlist",
            422,  # FastAPI validation error
            data={}
        )
        
        # Test invalid email format (this might still return 200 depending on backend validation)
        success2, _ = self.run_test(
            "Join Waitlist (Invalid Email)",
            "POST",
            "api/waitlist",
            422,  # Expected validation error
            data={"first_name": "Test", "email": "invalid-email"}
        )
        
        return success1 or success2, {}

    def test_join_waitlist_with_referral(self):
        """Test joining waitlist with referral code"""
        if not self.test_referral_code:
            print("   ⚠️  No referral code available for testing")
            return False, {}
        
        # Get referrer's initial stats
        referrer_success, referrer_initial = self.run_test(
            "Get Referrer Initial Stats",
            "GET",
            f"api/waitlist/stats/{self.test_referral_code}",
            200,
            expected_fields=["referral_code", "referral_count", "position", "referral_link"]
        )
        
        if not referrer_success:
            return False, {}
        
        initial_position = referrer_initial.get("position", 0)
        initial_count = referrer_initial.get("referral_count", 0)
        
        # Join with referral code
        test_data = {
            "first_name": f"Referred_{datetime.now().strftime('%H%M%S')}",
            "email": f"referred_{datetime.now().strftime('%H%M%S')}@example.com",
            "ref_code": self.test_referral_code
        }
        
        success, response = self.run_test(
            "Join Waitlist (With Referral)",
            "POST",
            "api/waitlist",
            200,
            data=test_data,
            expected_fields=["id", "first_name", "email", "position", "timestamp", "referral_code", "referral_count"]
        )
        
        if success:
            # Check referrer's updated stats
            referrer_success2, referrer_updated = self.run_test(
                "Get Referrer Updated Stats",
                "GET",
                f"api/waitlist/stats/{self.test_referral_code}",
                200,
                expected_fields=["referral_code", "referral_count", "position", "referral_link"]
            )
            
            if referrer_success2:
                new_position = referrer_updated.get("position", 0)
                new_count = referrer_updated.get("referral_count", 0)
                
                # Verify referral count increased
                if new_count == initial_count + 1:
                    print(f"   ✅ Referral count increased from {initial_count} to {new_count}")
                else:
                    print(f"   ❌ Referral count should be {initial_count + 1}, got {new_count}")
                
                # Verify position decreased by 5 (or to minimum 1)
                expected_position = max(1, initial_position - 5)
                if new_position == expected_position:
                    print(f"   ✅ Position decreased from {initial_position} to {new_position}")
                else:
                    print(f"   ❌ Position should be {expected_position}, got {new_position}")
        
        return success, response

    def test_leaderboard_endpoint(self):
        """Test the referral leaderboard endpoint"""
        success, response = self.run_test(
            "Get Referral Leaderboard",
            "GET",
            "api/waitlist/leaderboard",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Leaderboard returned {len(response)} entries")
            
            # Check if entries are sorted by referral_count desc
            if len(response) > 1:
                for i in range(len(response) - 1):
                    current_count = response[i].get("referral_count", 0)
                    next_count = response[i + 1].get("referral_count", 0)
                    if current_count < next_count:
                        print(f"   ❌ Leaderboard not sorted correctly")
                        break
                else:
                    print(f"   ✅ Leaderboard sorted by referral_count desc")
            
            # Check required fields in each entry
            for i, entry in enumerate(response[:3]):  # Check first 3 entries
                required_fields = ["first_name", "referral_code", "referral_count", "position"]
                missing_fields = [field for field in required_fields if field not in entry]
                if missing_fields:
                    print(f"   ❌ Entry {i} missing fields: {missing_fields}")
                else:
                    print(f"   ✅ Entry {i} has all required fields")
        
        return success, response

    def test_referral_stats_endpoint(self):
        """Test the referral stats endpoint"""
        if not self.test_referral_code:
            print("   ⚠️  No referral code available for testing")
            return False, {}
        
        success, response = self.run_test(
            "Get Referral Stats",
            "GET",
            f"api/waitlist/stats/{self.test_referral_code}",
            200,
            expected_fields=["referral_code", "referral_count", "position", "referral_link"]
        )
        
        if success:
            # Verify referral_link format
            referral_link = response.get("referral_link", "")
            expected_link = f"?ref={self.test_referral_code}"
            if referral_link == expected_link:
                print(f"   ✅ Referral link format correct: {referral_link}")
            else:
                print(f"   ❌ Referral link should be {expected_link}, got {referral_link}")
        
        return success, response

    def test_referral_stats_not_found(self):
        """Test referral stats with invalid code"""
        return self.run_test(
            "Get Referral Stats (Not Found)",
            "GET",
            "api/waitlist/stats/INVALID",
            404
        )

def main():
    print("🚀 Starting Valuevade API Tests (with Referral System)")
    print("=" * 60)
    
    # Setup
    tester = ValuevadeAPITester()
    
    # Run all tests
    print("\n📋 Running Backend API Tests...")
    
    # Test 1: Root endpoint
    tester.test_root_endpoint()
    
    # Test 2: Waitlist count
    tester.test_waitlist_count()
    
    # Test 3: Valid waitlist submission (stores referral code for later tests)
    tester.test_join_waitlist_valid()
    
    # Test 4: Duplicate email handling
    tester.test_join_waitlist_duplicate()
    
    # Test 5: Invalid data handling
    tester.test_join_waitlist_invalid()
    
    # Test 6: Referral system - join with referral code
    tester.test_join_waitlist_with_referral()
    
    # Test 7: Leaderboard endpoint
    tester.test_leaderboard_endpoint()
    
    # Test 8: Referral stats endpoint
    tester.test_referral_stats_endpoint()
    
    # Test 9: Referral stats not found
    tester.test_referral_stats_not_found()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed. Check the details above.")
        
        # Print failed tests summary
        failed_tests = [t for t in tester.test_results if t["status"] != "PASSED"]
        if failed_tests:
            print("\n🔍 Failed Tests Summary:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['status']}")
        
        return 1

if __name__ == "__main__":
    sys.exit(main())