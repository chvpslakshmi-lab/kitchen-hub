"""
Seed the Kitchen Pro database with realistic data.
Run once: python seed.py
"""
import os, sys

# Make sure we're in the right directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app import app
from models import db, Category, Ingredient, Recipe, RecipeIngredient

CATEGORIES = [
    "Starters", "Mains", "Pasta & Grains", "Soups & Stews",
    "Salads", "Desserts", "Sides", "Sauces & Condiments"
]

INGREDIENTS = [
    # Proteins
    {"name": "Chicken Breast",       "unit": "kg",  "stock_qty": 15.0,  "reorder_level": 5.0,  "cost_per_unit": 8.5,  "category": "Proteins"},
    {"name": "Salmon Fillet",         "unit": "kg",  "stock_qty": 8.0,   "reorder_level": 3.0,  "cost_per_unit": 18.0, "category": "Proteins"},
    {"name": "Beef Tenderloin",       "unit": "kg",  "stock_qty": 6.0,   "reorder_level": 3.0,  "cost_per_unit": 30.0, "category": "Proteins"},
    {"name": "Shrimp",                "unit": "kg",  "stock_qty": 4.0,   "reorder_level": 2.0,  "cost_per_unit": 14.0, "category": "Proteins"},
    {"name": "Duck Breast",           "unit": "kg",  "stock_qty": 2.0,   "reorder_level": 2.5,  "cost_per_unit": 22.0, "category": "Proteins"},
    # Vegetables
    {"name": "Garlic",                "unit": "g",   "stock_qty": 800.0, "reorder_level": 200.0,"cost_per_unit": 0.01, "category": "Vegetables"},
    {"name": "Onion",                 "unit": "kg",  "stock_qty": 10.0,  "reorder_level": 3.0,  "cost_per_unit": 0.8,  "category": "Vegetables"},
    {"name": "Tomato",                "unit": "kg",  "stock_qty": 12.0,  "reorder_level": 4.0,  "cost_per_unit": 1.5,  "category": "Vegetables"},
    {"name": "Spinach",               "unit": "kg",  "stock_qty": 3.0,   "reorder_level": 1.5,  "cost_per_unit": 3.0,  "category": "Vegetables"},
    {"name": "Bell Pepper",           "unit": "kg",  "stock_qty": 5.0,   "reorder_level": 2.0,  "cost_per_unit": 2.5,  "category": "Vegetables"},
    {"name": "Broccoli",              "unit": "kg",  "stock_qty": 4.0,   "reorder_level": 2.0,  "cost_per_unit": 2.0,  "category": "Vegetables"},
    {"name": "Mushrooms",             "unit": "kg",  "stock_qty": 3.5,   "reorder_level": 1.5,  "cost_per_unit": 7.0,  "category": "Vegetables"},
    {"name": "Zucchini",              "unit": "kg",  "stock_qty": 0.8,   "reorder_level": 2.0,  "cost_per_unit": 1.8,  "category": "Vegetables"},
    # Dairy
    {"name": "Heavy Cream",           "unit": "L",   "stock_qty": 8.0,   "reorder_level": 3.0,  "cost_per_unit": 3.5,  "category": "Dairy"},
    {"name": "Parmesan Cheese",       "unit": "g",   "stock_qty": 600.0, "reorder_level": 200.0,"cost_per_unit": 0.04, "category": "Dairy"},
    {"name": "Butter",                "unit": "kg",  "stock_qty": 4.0,   "reorder_level": 1.5,  "cost_per_unit": 9.0,  "category": "Dairy"},
    {"name": "Mozzarella",            "unit": "kg",  "stock_qty": 3.0,   "reorder_level": 1.0,  "cost_per_unit": 12.0, "category": "Dairy"},
    # Dry Goods
    {"name": "Pasta (Tagliatelle)",   "unit": "kg",  "stock_qty": 6.0,   "reorder_level": 2.0,  "cost_per_unit": 2.0,  "category": "Dry Goods"},
    {"name": "Arborio Rice",          "unit": "kg",  "stock_qty": 5.0,   "reorder_level": 2.0,  "cost_per_unit": 3.5,  "category": "Dry Goods"},
    {"name": "Bread Crumbs",          "unit": "g",   "stock_qty": 1200.0,"reorder_level": 400.0,"cost_per_unit": 0.003,"category": "Dry Goods"},
    {"name": "All-Purpose Flour",     "unit": "kg",  "stock_qty": 8.0,   "reorder_level": 3.0,  "cost_per_unit": 1.0,  "category": "Dry Goods"},
    # Liquids & Sauces
    {"name": "Olive Oil",             "unit": "L",   "stock_qty": 5.0,   "reorder_level": 2.0,  "cost_per_unit": 6.0,  "category": "Liquids"},
    {"name": "White Wine",            "unit": "L",   "stock_qty": 3.0,   "reorder_level": 1.5,  "cost_per_unit": 8.0,  "category": "Liquids"},
    {"name": "Chicken Stock",         "unit": "L",   "stock_qty": 10.0,  "reorder_level": 4.0,  "cost_per_unit": 2.0,  "category": "Liquids"},
    {"name": "Soy Sauce",             "unit": "mL",  "stock_qty": 500.0, "reorder_level": 150.0,"cost_per_unit": 0.015,"category": "Liquids"},
    # Herbs & Spices
    {"name": "Fresh Basil",           "unit": "g",   "stock_qty": 150.0, "reorder_level": 80.0, "cost_per_unit": 0.08, "category": "Herbs"},
    {"name": "Thyme",                 "unit": "g",   "stock_qty": 100.0, "reorder_level": 50.0, "cost_per_unit": 0.05, "category": "Herbs"},
    {"name": "Rosemary",              "unit": "g",   "stock_qty": 80.0,  "reorder_level": 50.0, "cost_per_unit": 0.06, "category": "Herbs"},
    {"name": "Black Pepper",          "unit": "g",   "stock_qty": 300.0, "reorder_level": 100.0,"cost_per_unit": 0.02, "category": "Spices"},
    {"name": "Salt",                  "unit": "kg",  "stock_qty": 5.0,   "reorder_level": 2.0,  "cost_per_unit": 0.5,  "category": "Spices"},
]

RECIPES = [
    {
        "name": "Grilled Herb Chicken",
        "category": "Mains",
        "prep_time": 20, "cook_time": 35, "servings": 4,
        "quality_score": 9.2, "consistency_rating": 9.5,
        "instructions": "Marinate chicken with olive oil, rosemary, thyme, garlic. Grill on high heat 35 min turning halfway. Rest 5 min before serving.",
        "ingredients": [
            ("Chicken Breast", 0.8), ("Olive Oil", 0.05), ("Rosemary", 10),
            ("Thyme", 8), ("Garlic", 20), ("Salt", 0.01), ("Black Pepper", 5),
        ]
    },
    {
        "name": "Mushroom Risotto",
        "category": "Pasta & Grains",
        "prep_time": 15, "cook_time": 40, "servings": 4,
        "quality_score": 9.0, "consistency_rating": 8.8,
        "instructions": "Sauté onions and garlic in butter. Add Arborio rice, toast 2 min. Deglaze with white wine. Add stock ladle by ladle stirring constantly 25-30 min. Fold in mushrooms and parmesan.",
        "ingredients": [
            ("Arborio Rice", 0.4), ("Mushrooms", 0.3), ("Butter", 0.06),
            ("White Wine", 0.15), ("Chicken Stock", 0.8), ("Parmesan Cheese", 60),
            ("Onion", 0.15), ("Garlic", 15), ("Thyme", 5),
        ]
    },
    {
        "name": "Pan-Seared Salmon",
        "category": "Mains",
        "prep_time": 10, "cook_time": 15, "servings": 2,
        "quality_score": 9.4, "consistency_rating": 9.1,
        "instructions": "Pat salmon dry, season. Heat ovenproof skillet till smoking. Sear skin-side 3 min, flip 2 min. Baste with butter and thyme. Finish in oven 4 min at 200°C.",
        "ingredients": [
            ("Salmon Fillet", 0.4), ("Butter", 0.04), ("Thyme", 5),
            ("Garlic", 10), ("Olive Oil", 0.02), ("Salt", 0.005), ("Black Pepper", 3),
        ]
    },
    {
        "name": "Beef Tenderloin with Red Wine Reduction",
        "category": "Mains",
        "prep_time": 30, "cook_time": 45, "servings": 4,
        "quality_score": 9.7, "consistency_rating": 8.5,
        "instructions": "Sear beef all sides in cast iron. Roast 220°C to internal 57°C. Make reduction with red wine and stock. Rest 10 min before slicing.",
        "ingredients": [
            ("Beef Tenderloin", 0.8), ("Butter", 0.05), ("Rosemary", 8),
            ("Thyme", 5), ("Garlic", 25), ("Salt", 0.015), ("Black Pepper", 5),
        ]
    },
    {
        "name": "Shrimp Scampi Pasta",
        "category": "Pasta & Grains",
        "prep_time": 15, "cook_time": 20, "servings": 4,
        "quality_score": 8.8, "consistency_rating": 9.2,
        "instructions": "Cook pasta al dente. Sauté shrimp in olive oil and garlic 2 min per side. Deglaze white wine, add butter, toss pasta with fresh basil.",
        "ingredients": [
            ("Shrimp", 0.5), ("Pasta (Tagliatelle)", 0.4), ("Olive Oil", 0.04),
            ("Garlic", 20), ("White Wine", 0.1), ("Butter", 0.04),
            ("Fresh Basil", 15), ("Salt", 0.01), ("Black Pepper", 4),
        ]
    },
    {
        "name": "Classic Caesar Salad",
        "category": "Salads",
        "prep_time": 20, "cook_time": 10, "servings": 4,
        "quality_score": 8.5, "consistency_rating": 9.4,
        "instructions": "Make dressing with garlic, olive oil, parmesan. Toast bread crumbs for croutons. Toss romaine with dressing and grated parmesan.",
        "ingredients": [
            ("Parmesan Cheese", 80), ("Olive Oil", 0.06), ("Garlic", 10),
            ("Bread Crumbs", 100), ("Salt", 0.005), ("Black Pepper", 3),
        ]
    },
    {
        "name": "Cream of Tomato Soup",
        "category": "Soups & Stews",
        "prep_time": 15, "cook_time": 35, "servings": 6,
        "quality_score": 8.2, "consistency_rating": 9.6,
        "instructions": "Roast tomatoes 20 min. Sauté onion and garlic. Add roasted tomatoes and stock, simmer 15 min. Blend smooth, stir in cream, season.",
        "ingredients": [
            ("Tomato", 1.2), ("Onion", 0.2), ("Garlic", 15),
            ("Heavy Cream", 0.25), ("Chicken Stock", 0.5), ("Butter", 0.03),
            ("Fresh Basil", 10), ("Salt", 0.01), ("Black Pepper", 4),
        ]
    },
    {
        "name": "Duck Breast à l'Orange",
        "category": "Mains",
        "prep_time": 25, "cook_time": 30, "servings": 2,
        "quality_score": 9.5, "consistency_rating": 8.0,
        "instructions": "Score duck skin, season. Render fat in cold pan, increase heat to crisp skin. Roast 180°C 10 min. Make orange sauce with stock and white wine.",
        "ingredients": [
            ("Duck Breast", 0.4), ("White Wine", 0.1), ("Chicken Stock", 0.2),
            ("Butter", 0.03), ("Salt", 0.008), ("Black Pepper", 3), ("Thyme", 5),
        ]
    },
    {
        "name": "Spinach and Ricotta Stuffed Peppers",
        "category": "Starters",
        "prep_time": 25, "cook_time": 35, "servings": 4,
        "quality_score": 8.0, "consistency_rating": 9.0,
        "instructions": "Blanch spinach, squeeze dry. Mix with mozzarella and seasoning. Halve bell peppers, stuff with mixture. Bake 200°C 30-35 min.",
        "ingredients": [
            ("Bell Pepper", 0.6), ("Spinach", 0.3), ("Mozzarella", 0.25),
            ("Garlic", 10), ("Olive Oil", 0.03), ("Salt", 0.008), ("Black Pepper", 3),
        ]
    },
    {
        "name": "Broccoli Stir-Fry",
        "category": "Sides",
        "prep_time": 10, "cook_time": 12, "servings": 4,
        "quality_score": 7.8, "consistency_rating": 9.3,
        "instructions": "Blanch broccoli 2 min. Heat wok to smoking, stir-fry broccoli 3 min. Add garlic, soy sauce, sesame, toss 1 min.",
        "ingredients": [
            ("Broccoli", 0.5), ("Garlic", 15), ("Soy Sauce", 30),
            ("Olive Oil", 0.02), ("Salt", 0.005), ("Black Pepper", 2),
        ]
    },
    {
        "name": "Zucchini Fritters",
        "category": "Starters",
        "prep_time": 20, "cook_time": 15, "servings": 4,
        "quality_score": 7.6, "consistency_rating": 8.8,
        "instructions": "Grate zucchini, salt and let drain 10 min. Squeeze moisture. Mix with flour and seasoning. Pan-fry in olive oil until golden.",
        "ingredients": [
            ("Zucchini", 0.6), ("All-Purpose Flour", 0.12), ("Olive Oil", 0.05),
            ("Salt", 0.01), ("Black Pepper", 3), ("Garlic", 10),
        ]
    },
]


def seed():
    with app.app_context():
        db.create_all()

        # Skip if already seeded
        if Category.query.first():
            print("Database already seeded. Skipping.")
            return

        print("Seeding categories...")
        cat_map = {}
        for name in CATEGORIES:
            c = Category(name=name)
            db.session.add(c)
            db.session.flush()
            cat_map[name] = c.id

        print("Seeding ingredients...")
        ing_map = {}
        for ing_data in INGREDIENTS:
            ing = Ingredient(**ing_data)
            db.session.add(ing)
            db.session.flush()
            ing_map[ing_data["name"]] = ing.id

        print("Seeding recipes...")
        for rec_data in RECIPES:
            r = Recipe(
                name=rec_data["name"],
                category_id=cat_map.get(rec_data["category"]),
                prep_time=rec_data["prep_time"],
                cook_time=rec_data["cook_time"],
                servings=rec_data["servings"],
                quality_score=rec_data["quality_score"],
                consistency_rating=rec_data["consistency_rating"],
                instructions=rec_data["instructions"],
            )
            db.session.add(r)
            db.session.flush()
            for ing_name, qty in rec_data["ingredients"]:
                if ing_name in ing_map:
                    ri = RecipeIngredient(
                        recipe_id=r.id,
                        ingredient_id=ing_map[ing_name],
                        quantity_needed=qty,
                    )
                    db.session.add(ri)

        db.session.commit()
        print("✓ Seeding complete!")


if __name__ == "__main__":
    seed()
