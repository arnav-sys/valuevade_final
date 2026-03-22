import requests
import sys
import json
from datetime import datetime

class ValuevadeAPITester:
    def __init__(self, base_url="https://ai-career-path-23.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
            expected_fields=["id", "first_name", "email", "position", "timestamp"]
        )
        
        if success and response:
            # Verify position is in expected range
            position = response.get("position", 0)
            if 200 <= position <= 350:
                print(f"   ✅ Position {position} is in expected range (200-350)")
            else:
                print(f"   ⚠️  Position {position} is outside expected range (200-350)")
        
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
            expected_fields=["id", "first_name", "email", "position", "timestamp"]
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

def main():
    print("🚀 Starting Valuevade API Tests")
    print("=" * 50)
    
    # Setup
    tester = ValuevadeAPITester()
    
    # Run all tests
    print("\n📋 Running Backend API Tests...")
    
    # Test 1: Root endpoint
    tester.test_root_endpoint()
    
    # Test 2: Waitlist count
    tester.test_waitlist_count()
    
    # Test 3: Valid waitlist submission
    tester.test_join_waitlist_valid()
    
    # Test 4: Duplicate email handling
    tester.test_join_waitlist_duplicate()
    
    # Test 5: Invalid data handling
    tester.test_join_waitlist_invalid()
    
    # Print final results
    print("\n" + "=" * 50)
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