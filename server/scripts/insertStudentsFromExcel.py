#!/usr/bin/env python3
"""
Script to insert students from Excel file into MongoDB
Reads student data from Excel and inserts into 'student' collection
"""

import pandas as pd
import pymongo
import os
import sys
from dotenv import load_dotenv
from datetime import datetime
from bson.objectid import ObjectId
import json

# Load environment variables
load_dotenv()

# MongoDB connection
DBURL = os.getenv('DBURL')
if not DBURL:
    print("✗ Error: DBURL environment variable not set")
    sys.exit(1)

def connect_to_db():
    """Connect to MongoDB"""
    try:
        client = pymongo.MongoClient(DBURL)
        db = client['vjhostel']  # Database name
        return db
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

# Configuration: set batch years and detection prefix
YEAR = "2022-26"          # default year for normal rolls
YEAR_LE = "2023-26"     # year for lateral entry (LE) rolls
LE_PREFIX = "23"           # if rollNumber starts with this, consider it LE and assign YEAR_LE

def read_excel_file(file_path):
    """Read Excel file and return DataFrame, handling merged headers"""
    try:
        # First, read with header in row 1 (0-indexed) to skip merged title row
        df = pd.read_excel(file_path, header=1)
        
        # Clean up column names - strip whitespace
        df.columns = df.columns.str.strip()
        
        print(f"✓ Successfully read Excel file with {len(df)} rows")
        print(f"Columns: {df.columns.tolist()}")
        return df
    except FileNotFoundError:
        print(f"✗ Excel file not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error reading Excel file: {e}")
        sys.exit(1)

def create_student_document(row):
    """
    Create a student document from Excel row
    Maps Excel columns to StudentModel schema
    Handles empty fields with appropriate defaults
    """
    try:
        # Helper function to safely extract and clean field values
        def get_field(field_name, default="", uppercase=False, allow_none=False, is_phone=False):
            """Safely extract field from row with default handling"""
            try:
                if field_name in row.index and pd.notna(row[field_name]):
                    value = row[field_name]
                    
                    # Handle phone numbers - convert to int then string to remove .0
                    if is_phone:
                        try:
                            # Convert to float first (in case it's stored as float in Excel)
                            phone_num = float(value)
                            # Convert to int to remove decimal, then to string
                            value = str(int(phone_num))
                        except (ValueError, TypeError):
                            # If conversion fails, treat as string
                            value = str(value).strip()
                    else:
                        value = str(value).strip()
                    
                    # Skip NaN-like strings
                    if value.lower() not in ['nan', 'none', '']:
                        return value.upper() if uppercase else value
                return None if allow_none else default
            except:
                return None if allow_none else default
        
        # Extract data from row with proper defaults
        # Handle various column name formats (with/without trailing spaces)
        roll_number = get_field('ID NO', default="")
        name = get_field('NAME OF STUDENT', default="", uppercase=True)
        room = get_field('New Room', default=None, allow_none=True)
        
        # Handle phone columns with possible trailing spaces - use is_phone=True to clean .0
        phone = get_field('STUDENT MOBILE', default="", is_phone=True)
        if not phone or phone == "":
            phone = get_field('STUDENT MOBILE ', default="", is_phone=True)
        
        parent_phone = get_field('PARENT MOBILE', default="", is_phone=True)
        if not parent_phone or parent_phone == "":
            parent_phone = get_field('PARENT MOBILE ', default="", is_phone=True)
        
        parent_name = get_field('PARENT NAME', default="", uppercase=True)
        branch = get_field('BRANCH', default="")
        remarks = get_field('REMARKS', default="")
        
        # Handle room - convert to None if empty string and normalize (remove /1, /2 suffixes)
        if room and room != "":
            try:
                # remove anything after a slash and trim
                room = str(room).split('/')[0].strip()
                if room == "":
                    room = None
            except Exception:
                room = None
        else:
            room = None

        # Generate email from roll number
        email = f"{roll_number}@vnrvjiet.in".lower() if roll_number else ""

        # Determine year based on roll prefix (LE vs normal)
        roll_prefix = (roll_number or "").strip()
        if roll_prefix.startswith(LE_PREFIX):
            batch_year = YEAR_LE
        else:
            batch_year = YEAR

        # Create student document according to StudentModel schema
        # All fields default to empty strings, empty arrays, or None as appropriate
        student_doc = {
            "rollNumber": roll_number or "",
            "username": name or "",
            "phoneNumber": phone or "",
            "parentMobileNumber": parent_phone or "",
            "parentName": parent_name or "",
            "password": None,  # Will be set separately or use Google auth
            "name": name or "",
            "email": email or "",
            "branch": branch or "",
            "role": "student",
            "is_active": True,
            "room": room,  # None if empty, string if has value
            "year": str(batch_year),
            "fcmToken": None,
            "backupContacts": [],
            "whitelist": [],
            "autoApproveParents": False,
            "preferences": {
                "allowVisitorsOutOfHours": False,
                "requirePhotoVerification": True,
                "maxVisitorsPerDay": 15
            },
            "remarks": remarks or None,  # None if empty, string if has value
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }

        return student_doc

    except Exception as e:
        print(f"✗ Error creating student document: {e}")
        print(f"Row data: {row.to_dict()}")
        return None

def clean_existing_phone_numbers(db):
    """
    Clean up existing student records that have phone numbers with .0 suffix
    This helps when re-running the import with mode 2 (upsert)
    """
    try:
        collection = db['students']
        
        # Find all students with .0 in their phone numbers
        students_to_fix = collection.find({
            "$or": [
                {"phoneNumber": {"$regex": r"\.0$"}},
                {"parentMobileNumber": {"$regex": r"\.0$"}}
            ]
        })
        
        fixed_count = 0
        for student in students_to_fix:
            updates = {}
            
            # Fix phoneNumber if it has .0
            if student.get('phoneNumber') and str(student.get('phoneNumber')).endswith('.0'):
                phone = str(student.get('phoneNumber'))
                updates['phoneNumber'] = phone.replace('.0', '')
            
            # Fix parentMobileNumber if it has .0
            if student.get('parentMobileNumber') and str(student.get('parentMobileNumber')).endswith('.0'):
                parent_phone = str(student.get('parentMobileNumber'))
                updates['parentMobileNumber'] = parent_phone.replace('.0', '')
            
            if updates:
                collection.update_one(
                    {"_id": student["_id"]},
                    {"$set": updates}
                )
                fixed_count += 1
        
        if fixed_count > 0:
            print(f"✓ Cleaned {fixed_count} existing records with .0 in phone numbers")
        
        return fixed_count
    
    except Exception as e:
        print(f"⚠ Warning: Could not clean existing phone numbers: {e}")
        return 0

def insert_students(db, students_list):
    """Insert students into MongoDB collection"""
    if not students_list:
        print("✗ No valid students to insert")
        return 0

    try:
        collection = db['students']  # Collection name
        
        # Insert many documents
        result = collection.insert_many(students_list, ordered=False)

        # After insertion, ensure Room documents are updated to include occupants
        rooms_col = db['rooms']
        for idx, inserted_id in enumerate(result.inserted_ids):
            try:
                stud = students_list[idx]
                room_num = stud.get('room')
                if room_num and room_num != "":
                    rooms_col.update_one(
                        {"roomNumber": room_num},
                        {
                            "$addToSet": {"occupants": inserted_id, "allocatedStudents": inserted_id},
                            "$setOnInsert": {"capacity": 3}
                        },
                        upsert=True
                    )
            except Exception as e:
                print(f"⚠ Warning: could not update room for inserted student {inserted_id}: {e}")

        print(f"\n✓ Successfully inserted {len(result.inserted_ids)} students")
        return len(result.inserted_ids)

    except pymongo.errors.BulkWriteError as e:
        # Handle duplicate key errors gracefully
        print(f"\n⚠ Bulk write error (some documents may have duplicates):")
        print(f"  Inserted: {e.details['nInserted']}")
        print(f"  Duplicates/Errors: {len(e.details['writeErrors'])}")
        return e.details['nInserted']
    except Exception as e:
        print(f"✗ Error inserting students: {e}")
        return 0

def update_duplicate_students(db, students_list):
    """Update existing students or insert new ones (upsert)"""
    if not students_list:
        print("✗ No valid students to process")
        return 0

    try:
        collection = db['students']
        rooms_col = db['rooms']
        updated_count = 0

        for student in students_list:
            # Use rollNumber and email as unique identifiers
            try:
                result = collection.update_one(
                    {"rollNumber": student["rollNumber"]},
                    {"$set": student},
                    upsert=True
                )

                # Determine the student's ObjectId (newly upserted or existing)
                student_id = None
                if result.upserted_id:
                    student_id = result.upserted_id
                else:
                    # fetch existing document _id
                    existing = collection.find_one({"rollNumber": student["rollNumber"]}, {"_id": 1})
                    if existing:
                        student_id = existing.get('_id')

                # If room is provided, ensure room document includes this student
                room_num = student.get('room')
                if student_id and room_num and room_num != "":
                    try:
                        rooms_col.update_one(
                            {"roomNumber": room_num},
                            {
                                "$addToSet": {"occupants": student_id, "allocatedStudents": student_id},
                                "$setOnInsert": {"capacity": 3}
                            },
                            upsert=True
                        )
                    except Exception as e:
                        print(f"⚠ Warning: could not update room {room_num} for student {student.get('rollNumber')}: {e}")

                if result.upserted_id or result.modified_count > 0:
                    updated_count += 1
            except Exception as e:
                print(f"✗ Error processing student {student.get('rollNumber')}: {e}")

        print(f"\n✓ Successfully processed {updated_count} students (inserted new or updated existing)")
        return updated_count

    except Exception as e:
        print(f"✗ Error updating students: {e}")
        return 0

def validate_student_data(student_doc):
    """
    Validate student document has required fields
    At minimum: rollNumber, name, and either parentName or parentMobileNumber
    """
    # Critical fields that must not be empty
    critical_fields = {
        'rollNumber': 'Roll Number (ID NO)',
        'name': 'Student Name',
    }
    
    # At least one of these parent fields must exist
    parent_fields = {
        'parentName': 'Parent Name',
        'parentMobileNumber': 'Parent Mobile'
    }
    
    # Check critical fields
    for field, label in critical_fields.items():
        value = student_doc.get(field)
        if not value or value == "":
            print(f"    ✗ Missing critical field: {label}")
            return False
    
    # Check at least one parent field exists
    has_parent_info = any(student_doc.get(field) and student_doc.get(field) != "" 
                          for field in parent_fields)
    if not has_parent_info:
        print(f"    ✗ Missing parent information (Name or Mobile)")
        return False
    
    return True

def main():
    """Main function"""
    print("=" * 60)
    print("Student Data Import Script")
    print("=" * 60)

    # Dynamically locate the Excel file inside ../seedData/
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # path to /server/scripts
    excel_file = os.path.join(BASE_DIR, "../seedData/vnrboys-4.xlsx")
    excel_file = os.path.abspath(excel_file)
    
    # Check if file path provided as command line argument
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]

    # Check if file exists
    if not os.path.exists(excel_file):
        print(f"\nSearching for Excel files in current directory...")
        excel_files = [f for f in os.listdir('.') if f.endswith(('.xlsx', '.xls'))]
        if excel_files:
            print(f"Found: {excel_files}")
            excel_file = excel_files[0]
            print(f"Using: {excel_file}")
        else:
            print(f"✗ No Excel file found. Please place your Excel file in the current directory.")
            print(f"   Or run: python insertStudentsFromExcel.py <path_to_excel_file>")
            sys.exit(1)

    # Read Excel file
    print(f"\nReading Excel file: {excel_file}")
    df = read_excel_file(excel_file)

    # Display sample row
    print("\n" + "=" * 60)
    print("Sample Data (First Row):")
    print("=" * 60)
    if len(df) > 0:
        print(df.iloc[0].to_dict())

    # Process each row
    print(f"\n" + "=" * 60)
    print("Processing {0} rows...".format(len(df)))
    print("=" * 60)

    valid_students = []
    invalid_count = 0

    for idx, row in df.iterrows():
        student_doc = create_student_document(row)
        
        if student_doc and validate_student_data(student_doc):
            valid_students.append(student_doc)
            print(f"✓ Row {idx + 1}: {student_doc['rollNumber']} - {student_doc['name']}")
        else:
            invalid_count += 1
            print(f"✗ Row {idx + 1}: Skipped (missing required fields)")

    print(f"\n" + "=" * 60)
    print(f"Validation Complete: {len(valid_students)} valid, {invalid_count} invalid")
    print("=" * 60)

    if not valid_students:
        print("\n✗ No valid students to insert. Exiting.")
        sys.exit(1)

    # Connect to database
    print("\nConnecting to MongoDB...")
    db = connect_to_db()
    print("✓ Connected to MongoDB")

    # Ask user for insert mode
    print("\n" + "=" * 60)
    print("Insert Mode Options:")
    print("=" * 60)
    print("1. Insert new students only (will skip duplicates)")
    print("2. Upsert (update existing, insert new)")
    
    choice = input("\nSelect mode (1 or 2): ").strip()

    if choice == "2":
        # Clean up existing records with .0 in phone numbers first
        print("\nCleaning up existing records...")
        clean_existing_phone_numbers(db)
        
        inserted = update_duplicate_students(db, valid_students)
    else:
        inserted = insert_students(db, valid_students)

    # Display summary
    print("\n" + "=" * 60)
    print("Import Summary")
    print("=" * 60)
    print(f"Total rows in Excel: {len(df)}")
    print(f"Valid students: {len(valid_students)}")
    print(f"Invalid students: {invalid_count}")
    print(f"Successfully processed: {inserted}")
    print("=" * 60)

    # Display sample of inserted students
    if inserted > 0:
        print("\nSample of inserted students:")
        collection = db['students']
        samples = list(collection.find({}).limit(3))
        for sample in samples:
            print(f"\n  Roll: {sample.get('rollNumber')}")
            print(f"  Name: {sample.get('name')}")
            print(f"  Email: {sample.get('email')}")
            print(f"  Room: {sample.get('room')}")

    print("\n✓ Import process completed!")

if __name__ == "__main__":
    main()
