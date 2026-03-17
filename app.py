import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from models import db, Category, Ingredient, Recipe, RecipeIngredient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'kitchen.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
CORS(app)
db.init_app(app)


# ─── Serve SPA ────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


# ─── Categories ───────────────────────────────────────────────────────────────
@app.route("/api/categories", methods=["GET"])
def get_categories():
    return jsonify([c.to_dict() for c in Category.query.all()])


# ─── Ingredients / Inventory ──────────────────────────────────────────────────
@app.route("/api/ingredients", methods=["GET"])
def get_ingredients():
    q = request.args.get("q", "").lower()
    items = Ingredient.query.all()
    if q:
        items = [i for i in items if q in i.name.lower()]
    return jsonify([i.to_dict() for i in items])


@app.route("/api/ingredients", methods=["POST"])
def create_ingredient():
    data = request.json
    ing = Ingredient(
        name=data["name"],
        unit=data.get("unit", "g"),
        stock_qty=float(data.get("stock_qty", 0)),
        reorder_level=float(data.get("reorder_level", 100)),
        cost_per_unit=float(data.get("cost_per_unit", 0)),
        category=data.get("category", "General"),
    )
    db.session.add(ing)
    db.session.commit()
    return jsonify(ing.to_dict()), 201


@app.route("/api/ingredients/<int:ing_id>", methods=["PUT"])
def update_ingredient(ing_id):
    ing = Ingredient.query.get_or_404(ing_id)
    data = request.json
    for field in ["name", "unit", "stock_qty", "reorder_level", "cost_per_unit", "category"]:
        if field in data:
            setattr(ing, field, float(data[field]) if field in ["stock_qty", "reorder_level", "cost_per_unit"] else data[field])
    db.session.commit()
    return jsonify(ing.to_dict())


@app.route("/api/ingredients/<int:ing_id>", methods=["DELETE"])
def delete_ingredient(ing_id):
    ing = Ingredient.query.get_or_404(ing_id)
    db.session.delete(ing)
    db.session.commit()
    return jsonify({"message": "deleted"})


# ─── Recipes ──────────────────────────────────────────────────────────────────
@app.route("/api/recipes", methods=["GET"])
def get_recipes():
    q = request.args.get("q", "").lower()
    cat = request.args.get("category_id")
    recipes = Recipe.query.filter_by(active=True).all()
    if q:
        recipes = [r for r in recipes if q in r.name.lower()]
    if cat:
        recipes = [r for r in recipes if r.category_id == int(cat)]
    return jsonify([r.to_dict(include_ingredients=True) for r in recipes])


@app.route("/api/recipes/<int:recipe_id>", methods=["GET"])
def get_recipe(recipe_id):
    r = Recipe.query.get_or_404(recipe_id)
    return jsonify(r.to_dict(include_ingredients=True))


@app.route("/api/recipes", methods=["POST"])
def create_recipe():
    data = request.json
    r = Recipe(
        name=data["name"],
        category_id=data.get("category_id"),
        prep_time=int(data.get("prep_time", 15)),
        cook_time=int(data.get("cook_time", 30)),
        servings=int(data.get("servings", 4)),
        quality_score=float(data.get("quality_score", 7.0)),
        consistency_rating=float(data.get("consistency_rating", 7.0)),
        instructions=data.get("instructions", ""),
        active=True,
    )
    db.session.add(r)
    db.session.flush()
    for item in data.get("ingredients", []):
        ri = RecipeIngredient(
            recipe_id=r.id,
            ingredient_id=int(item["ingredient_id"]),
            quantity_needed=float(item["quantity_needed"]),
        )
        db.session.add(ri)
    db.session.commit()
    return jsonify(r.to_dict(include_ingredients=True)), 201


@app.route("/api/recipes/<int:recipe_id>", methods=["PUT"])
def update_recipe(recipe_id):
    r = Recipe.query.get_or_404(recipe_id)
    data = request.json
    for field in ["name", "category_id", "prep_time", "cook_time", "servings", "quality_score", "consistency_rating", "instructions", "active"]:
        if field in data:
            val = data[field]
            if field in ["prep_time", "cook_time", "servings"]:
                val = int(val)
            elif field in ["quality_score", "consistency_rating"]:
                val = float(val)
            setattr(r, field, val)
    if "ingredients" in data:
        RecipeIngredient.query.filter_by(recipe_id=r.id).delete()
        for item in data["ingredients"]:
            ri = RecipeIngredient(
                recipe_id=r.id,
                ingredient_id=int(item["ingredient_id"]),
                quantity_needed=float(item["quantity_needed"]),
            )
            db.session.add(ri)
    db.session.commit()
    return jsonify(r.to_dict(include_ingredients=True))


@app.route("/api/recipes/<int:recipe_id>", methods=["DELETE"])
def delete_recipe(recipe_id):
    r = Recipe.query.get_or_404(recipe_id)
    r.active = False
    db.session.commit()
    return jsonify({"message": "archived"})


# ─── Recipe Suggestions ───────────────────────────────────────────────────────
@app.route("/api/suggest", methods=["GET"])
def suggest_recipes():
    """
    Composite score = 0.4*quality + 0.3*consistency + 0.3*availability_ratio
    availability_ratio = fraction of required ingredients that have sufficient stock
    """
    recipes = Recipe.query.filter_by(active=True).all()
    suggestions = []
    for r in recipes:
        ris = r.recipe_ingredients
        if not ris:
            availability = 0.5
            missing = []
        else:
            stocked = [ri for ri in ris if ri.ingredient.stock_qty >= ri.quantity_needed]
            availability = len(stocked) / len(ris)
            missing = [ri.ingredient.name for ri in ris if ri.ingredient.stock_qty < ri.quantity_needed]

        composite = 0.4 * r.quality_score + 0.3 * r.consistency_rating + 0.3 * (availability * 10)
        suggestions.append({
            **r.to_dict(include_ingredients=True),
            "composite_score": round(composite, 2),
            "availability_ratio": round(availability, 2),
            "missing_ingredients": missing,
            "can_make": len(missing) == 0,
        })
    suggestions.sort(key=lambda x: x["composite_score"], reverse=True)
    return jsonify(suggestions)


# ─── Analytics Dashboard ──────────────────────────────────────────────────────
@app.route("/api/analytics", methods=["GET"])
def analytics():
    total_recipes = Recipe.query.filter_by(active=True).count()
    total_ingredients = Ingredient.query.count()

    all_ings = Ingredient.query.all()
    low_stock = [i.to_dict() for i in all_ings if i.stock_qty <= i.reorder_level]
    critical_stock = [i for i in all_ings if i.stock_qty <= i.reorder_level * 0.25]

    all_recipes = Recipe.query.filter_by(active=True).all()
    avg_quality = round(sum(r.quality_score for r in all_recipes) / max(len(all_recipes), 1), 2)
    avg_consistency = round(sum(r.consistency_rating for r in all_recipes) / max(len(all_recipes), 1), 2)

    # Category breakdown
    categories = Category.query.all()
    category_breakdown = [
        {"name": c.name, "count": Recipe.query.filter_by(category_id=c.id, active=True).count()}
        for c in categories
    ]

    # Top recipes by quality
    top_recipes = sorted(all_recipes, key=lambda r: r.quality_score, reverse=True)[:5]

    # Stock value
    total_stock_value = round(sum(i.stock_qty * i.cost_per_unit for i in all_ings), 2)

    return jsonify({
        "total_recipes": total_recipes,
        "total_ingredients": total_ingredients,
        "low_stock_count": len(low_stock),
        "critical_stock_count": len(critical_stock),
        "avg_quality": avg_quality,
        "avg_consistency": avg_consistency,
        "total_stock_value": total_stock_value,
        "low_stock_items": low_stock[:5],
        "category_breakdown": category_breakdown,
        "top_recipes": [{"name": r.name, "quality_score": r.quality_score, "consistency_rating": r.consistency_rating} for r in top_recipes],
    })


# ─── Navigation Bar API ──────────────────────────────────────────────────────
NAV_PAGES = [
    {"key": "dashboard",           "title": "Dashboard",           "subtitle": "Today's kitchen overview",          "icon": "📊", "roles": ["admin", "customer"], "search": False, "action": None},
    {"key": "recipes",             "title": "Recipes",             "subtitle": "Manage your recipe library",        "icon": "📋", "roles": ["admin", "customer"], "search": True,  "action": "addRecipe",     "actionLabel": "+ Add Recipe"},
    {"key": "inventory",           "title": "Inventory",           "subtitle": "Track ingredient stock levels",     "icon": "📦", "roles": ["admin"],             "search": True,  "action": "addIngredient", "actionLabel": "+ Add Ingredient"},
    {"key": "check-quality",       "title": "Quality Check",       "subtitle": "AI image analysis for food safety", "icon": "🔍", "roles": ["admin", "customer"], "search": False, "action": None},
    {"key": "nearby-restaurants",  "title": "Nearby Restaurants",  "subtitle": "Explore local culinary partners",   "icon": "📍", "roles": ["admin", "customer"], "search": False, "action": None},
    {"key": "rating",              "title": "Recipe Ratings",      "subtitle": "Provide quality feedback",          "icon": "⭐", "roles": ["customer"],           "search": False, "action": None},
    {"key": "suggestions",         "title": "Suggestions",         "subtitle": "AI-optimized recipe picks",         "icon": "✨", "roles": ["admin", "customer"], "search": False, "action": None},
]


@app.route("/api/nav/pages", methods=["GET"])
def get_nav_pages():
    """Return sidebar navigation items filtered by role."""
    role = request.args.get("role", "admin").lower()
    return jsonify([
        {"key": p["key"], "title": p["title"], "subtitle": p["subtitle"], "icon": p["icon"],
         "search": p["search"], "action": p.get("action"), "actionLabel": p.get("actionLabel")}
        for p in NAV_PAGES if role in p["roles"]
    ])


# ─── Nearby Restaurants API ───────────────────────────────────────────────────
RESTAURANTS = [
    # ── India ──
    {"id": 0, "name": "The Gourmet Bistro", "cuisine": "French", "country": "India", "distance": "0.8 km", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "11:00 AM - 11:00 PM", "specialty": "Duck Confit & Wagyu Tartare", "price": "$$$$", "safety": "98% (A+)", "lat": 17.3850, "lng": 78.4867, "address": "12 Rue de la Cuisine, Banjara Hills, Hyderabad", "phone": "+91 40 2355 1234"},
    {"id": 1, "name": "Spice Route", "cuisine": "Indian", "country": "India", "distance": "1.2 km", "rating": 4.5, "type": "Casual Dining", "img": "", "hours": "12:00 PM - 10:30 PM", "specialty": "Smoked Butter Chicken", "price": "$$", "safety": "94% (A)", "lat": 17.3950, "lng": 78.4740, "address": "45 Spice Avenue, Jubilee Hills, Hyderabad", "phone": "+91 40 2355 5678"},
    {"id": 2, "name": "Sushi Zen", "cuisine": "Japanese", "country": "India", "distance": "3.2 km", "rating": 4.9, "type": "Sushi Bar", "img": "", "hours": "05:00 PM - 12:00 AM", "specialty": "Omakase Experience", "price": "$$$", "safety": "99% (A+)", "lat": 17.4100, "lng": 78.4500, "address": "8 Zen Lane, Madhapur, Hyderabad", "phone": "+91 40 2355 9012"},
    {"id": 3, "name": "Pasta Palace", "cuisine": "Italian", "country": "India", "distance": "1.5 km", "rating": 4.6, "type": "Trattoria", "img": "", "hours": "11:30 AM - 10:00 PM", "specialty": "Homemade Truffle Tagliatelle", "price": "$$$", "safety": "96% (A)", "lat": 17.3750, "lng": 78.4950, "address": "22 Via Roma, Gachibowli, Hyderabad", "phone": "+91 40 2355 3456"},
    {"id": 4, "name": "Burger Haven", "cuisine": "American", "country": "India", "distance": "0.5 km", "rating": 4.4, "type": "Fast Food", "img": "", "hours": "10:00 AM - 11:00 PM", "specialty": "Smoked Wagyu Burger", "price": "$$", "safety": "92% (A)", "lat": 17.3880, "lng": 78.4900, "address": "5 Liberty Road, Hitech City, Hyderabad", "phone": "+91 40 2355 7890"},
    {"id": 5, "name": "Green Garden", "cuisine": "Vegetarian", "country": "India", "distance": "1.8 km", "rating": 4.3, "type": "Eco-Friendly", "img": "", "hours": "08:00 AM - 09:30 PM", "specialty": "Organic Farm Bowl", "price": "$$", "safety": "97% (A+)", "lat": 17.4000, "lng": 78.4650, "address": "14 Green Park, Kondapur, Hyderabad", "phone": "+91 40 2355 2345"},
    {"id": 6, "name": "Mumbai Masala House", "cuisine": "Indian", "country": "India", "distance": "—", "rating": 4.7, "type": "Casual Dining", "img": "", "hours": "11:00 AM - 11:30 PM", "specialty": "Vada Pav & Pav Bhaji", "price": "$$", "safety": "95% (A)", "lat": 19.0760, "lng": 72.8777, "address": "Marine Drive, Mumbai", "phone": "+91 22 2355 1111"},
    {"id": 7, "name": "Karim's Delhi", "cuisine": "Indian", "country": "India", "distance": "—", "rating": 4.8, "type": "Heritage Dining", "img": "", "hours": "12:00 PM - 12:00 AM", "specialty": "Mutton Burra & Nihari", "price": "$$", "safety": "93% (A)", "lat": 28.6506, "lng": 77.2334, "address": "Jama Masjid, Old Delhi", "phone": "+91 11 2326 4981"},
    # ── France ──
    {"id": 8, "name": "Le Jules Verne", "cuisine": "French", "country": "France", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "12:00 PM - 01:30 AM", "specialty": "Lobster Thermidor & Soufflé", "price": "$$$$", "safety": "99% (A+)", "lat": 48.8584, "lng": 2.2945, "address": "Eiffel Tower, 2nd Floor, Paris", "phone": "+33 1 4555 6144"},
    {"id": 9, "name": "L'Ambroisie", "cuisine": "French", "country": "France", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "12:00 PM - 02:00 PM, 07:30 PM - 10:00 PM", "specialty": "Tarte Fine Sablée au Cacao", "price": "$$$$", "safety": "99% (A+)", "lat": 48.8537, "lng": 2.3615, "address": "9 Place des Vosges, Paris", "phone": "+33 1 4278 5145"},
    # ── Italy ──
    {"id": 10, "name": "Osteria Francescana", "cuisine": "Italian", "country": "Italy", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "12:30 PM - 02:00 PM, 08:00 PM - 10:30 PM", "specialty": "Five Ages of Parmigiano Reggiano", "price": "$$$$", "safety": "99% (A+)", "lat": 44.6471, "lng": 10.9252, "address": "Via Stella 22, Modena", "phone": "+39 059 223912"},
    {"id": 11, "name": "Pizzeria Da Michele", "cuisine": "Italian", "country": "Italy", "distance": "—", "rating": 4.7, "type": "Casual Dining", "img": "", "hours": "10:30 AM - 11:00 PM", "specialty": "Margherita & Marinara Pizza", "price": "$", "safety": "96% (A)", "lat": 40.8497, "lng": 14.2620, "address": "Via Cesare Sersale 1, Naples", "phone": "+39 081 553 9204"},
    # ── Japan ──
    {"id": 12, "name": "Sukiyabashi Jiro", "cuisine": "Japanese", "country": "Japan", "distance": "—", "rating": 5.0, "type": "Sushi Bar", "img": "", "hours": "05:00 PM - 08:30 PM", "specialty": "20-Course Omakase Sushi", "price": "$$$$", "safety": "99% (A+)", "lat": 35.6735, "lng": 139.7634, "address": "Tsukamoto Sogyo Bldg B1F, Ginza, Tokyo", "phone": "+81 3 3535 3600"},
    {"id": 13, "name": "Ichiran Ramen", "cuisine": "Japanese", "country": "Japan", "distance": "—", "rating": 4.6, "type": "Fast Casual", "img": "", "hours": "24 Hours", "specialty": "Tonkotsu Ramen", "price": "$$", "safety": "97% (A+)", "lat": 35.6614, "lng": 139.7045, "address": "1-22-7 Jinnan, Shibuya, Tokyo", "phone": "+81 3 3463 3667"},
    # ── USA ──
    {"id": 14, "name": "Per Se", "cuisine": "American", "country": "USA", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "05:30 PM - 09:30 PM", "specialty": "9-Course Tasting Menu", "price": "$$$$", "safety": "99% (A+)", "lat": 40.7688, "lng": -73.9829, "address": "10 Columbus Circle, New York", "phone": "+1 212 823 9335"},
    {"id": 15, "name": "In-N-Out Burger", "cuisine": "American", "country": "USA", "distance": "—", "rating": 4.5, "type": "Fast Food", "img": "", "hours": "10:30 AM - 01:00 AM", "specialty": "Double-Double Animal Style", "price": "$", "safety": "95% (A)", "lat": 34.0522, "lng": -118.2437, "address": "7009 Sunset Blvd, Los Angeles", "phone": "+1 800 786 1000"},
    {"id": 16, "name": "Franklin BBQ", "cuisine": "American", "country": "USA", "distance": "—", "rating": 4.8, "type": "BBQ Joint", "img": "", "hours": "11:00 AM - 03:00 PM", "specialty": "Brisket & Pulled Pork", "price": "$$", "safety": "96% (A)", "lat": 30.2700, "lng": -97.7311, "address": "900 E 11th St, Austin, Texas", "phone": "+1 512 653 1187"},
    # ── UK ──
    {"id": 17, "name": "The Ledbury", "cuisine": "British", "country": "UK", "distance": "—", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "06:30 PM - 09:30 PM", "specialty": "Flame-Grilled Mackerel & Venison", "price": "$$$$", "safety": "98% (A+)", "lat": 51.5155, "lng": -0.2010, "address": "127 Ledbury Rd, London", "phone": "+44 20 7792 9090"},
    {"id": 18, "name": "Dishoom", "cuisine": "Indian", "country": "UK", "distance": "—", "rating": 4.7, "type": "Casual Dining", "img": "", "hours": "08:00 AM - 11:00 PM", "specialty": "Black Daal & Bacon Naan Roll", "price": "$$", "safety": "96% (A)", "lat": 51.5197, "lng": -0.1305, "address": "5 Stable St, Kings Cross, London", "phone": "+44 20 7420 9321"},
    # ── Thailand ──
    {"id": 19, "name": "Gaggan Anand", "cuisine": "Thai", "country": "Thailand", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "06:00 PM - 11:00 PM", "specialty": "Progressive Indian-Thai Fusion", "price": "$$$$", "safety": "99% (A+)", "lat": 13.7365, "lng": 100.5509, "address": "68/1 Soi Langsuan, Bangkok", "phone": "+66 2 652 1700"},
    {"id": 20, "name": "Jay Fai", "cuisine": "Thai", "country": "Thailand", "distance": "—", "rating": 4.8, "type": "Street Food", "img": "", "hours": "03:00 PM - 02:00 AM", "specialty": "Crab Omelette & Drunken Noodles", "price": "$$", "safety": "94% (A)", "lat": 13.7525, "lng": 100.5059, "address": "327 Maha Chai Rd, Bangkok", "phone": "+66 2 223 9384"},
    # ── Mexico ──
    {"id": 21, "name": "Pujol", "cuisine": "Mexican", "country": "Mexico", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "01:30 PM - 11:00 PM", "specialty": "Mole Madre & Elote", "price": "$$$$", "safety": "98% (A+)", "lat": 19.4326, "lng": -99.1932, "address": "Tennyson 133, Polanco, Mexico City", "phone": "+52 55 5545 4111"},
    # ── Spain ──
    {"id": 22, "name": "El Celler de Can Roca", "cuisine": "Spanish", "country": "Spain", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "01:00 PM - 03:30 PM, 08:30 PM - 11:00 PM", "specialty": "A Trip to Havana (Dessert)", "price": "$$$$", "safety": "99% (A+)", "lat": 41.9909, "lng": 2.8117, "address": "Can Sunyer 48, Girona", "phone": "+34 972 222 157"},
    # ── Australia ──
    {"id": 23, "name": "Quay", "cuisine": "Australian", "country": "Australia", "distance": "—", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "06:00 PM - 10:00 PM", "specialty": "Snow Egg & Mud Crab Congee", "price": "$$$$", "safety": "99% (A+)", "lat": -33.8568, "lng": 151.2093, "address": "Upper Level, Overseas Passenger Terminal, Sydney", "phone": "+61 2 9251 5600"},
    # ── Brazil ──
    {"id": 24, "name": "D.O.M.", "cuisine": "Brazilian", "country": "Brazil", "distance": "—", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "07:00 PM - 12:00 AM", "specialty": "Amazonian Ants & Tucupi Broth", "price": "$$$$", "safety": "97% (A+)", "lat": -23.5632, "lng": -46.6654, "address": "Rua Barão de Capanema, São Paulo", "phone": "+55 11 3088 0761"},
    # ── South Korea ──
    {"id": 25, "name": "Jungsik Seoul", "cuisine": "Korean", "country": "South Korea", "distance": "—", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "12:00 PM - 03:00 PM, 06:00 PM - 10:00 PM", "specialty": "Bibimbap & Ganjang Gejang", "price": "$$$$", "safety": "98% (A+)", "lat": 37.5326, "lng": 126.9978, "address": "11 Seolleung-ro 158-gil, Gangnam, Seoul", "phone": "+82 2 517 4654"},
    # ── UAE ──
    {"id": 26, "name": "Nobu Dubai", "cuisine": "Japanese", "country": "UAE", "distance": "—", "rating": 4.7, "type": "Fine Dining", "img": "", "hours": "06:00 PM - 02:00 AM", "specialty": "Black Cod Miso & Yellowtail Jalapeño", "price": "$$$$", "safety": "98% (A+)", "lat": 25.2048, "lng": 55.2708, "address": "Atlantis The Palm, Dubai", "phone": "+971 4 426 2626"},
    # ── Peru ──
    {"id": 27, "name": "Central", "cuisine": "Peruvian", "country": "Peru", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "12:45 PM - 03:00 PM, 07:45 PM - 10:00 PM", "specialty": "Altitude Tasting Menu", "price": "$$$$", "safety": "99% (A+)", "lat": -12.1520, "lng": -77.0225, "address": "Av. Pedro de Osma 301, Lima", "phone": "+51 1 242 8515"},
    # ── Turkey ──
    {"id": 28, "name": "Nusr-Et Steakhouse", "cuisine": "Turkish", "country": "Turkey", "distance": "—", "rating": 4.5, "type": "Steakhouse", "img": "", "hours": "12:00 PM - 12:00 AM", "specialty": "Ottoman Steak & Salt Bae Special", "price": "$$$$", "safety": "95% (A)", "lat": 41.0423, "lng": 29.0078, "address": "Etiler, Istanbul", "phone": "+90 212 263 0535"},
    # ── Singapore ──
    {"id": 29, "name": "Hawker Chan", "cuisine": "Chinese", "country": "Singapore", "distance": "—", "rating": 4.6, "type": "Street Food", "img": "", "hours": "10:30 AM - 08:00 PM", "specialty": "Soya Sauce Chicken Rice", "price": "$", "safety": "96% (A)", "lat": 1.2850, "lng": 103.8460, "address": "78 Smith St, Singapore", "phone": "+65 6227 2277"},
    # ── South Africa ──
    {"id": 30, "name": "The Test Kitchen", "cuisine": "African", "country": "South Africa", "distance": "—", "rating": 4.8, "type": "Fine Dining", "img": "", "hours": "06:30 PM - 10:30 PM", "specialty": "Heritage Tasting Menu", "price": "$$$$", "safety": "97% (A+)", "lat": -33.9196, "lng": 18.4254, "address": "375 Albert Rd, Woodstock, Cape Town", "phone": "+27 21 447 2337"},
    # ── Germany ──
    {"id": 31, "name": "Restaurant Tim Raue", "cuisine": "German", "country": "Germany", "distance": "—", "rating": 4.7, "type": "Fine Dining", "img": "", "hours": "07:00 PM - 12:00 AM", "specialty": "Wasabi Langoustine & Peking Duck", "price": "$$$$", "safety": "98% (A+)", "lat": 52.5074, "lng": 13.3904, "address": "Rudi-Dutschke-Straße 26, Berlin", "phone": "+49 30 2593 7930"},
    # ── China ──
    {"id": 32, "name": "Ultraviolet", "cuisine": "Chinese", "country": "China", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "By Reservation Only", "specialty": "20-Course Multi-Sensory Menu", "price": "$$$$", "safety": "99% (A+)", "lat": 31.2304, "lng": 121.4737, "address": "Secret Location, Shanghai", "phone": "+86 21 6323 2328"},
    # ── Greece ──
    {"id": 33, "name": "Milos Athens", "cuisine": "Greek", "country": "Greece", "distance": "—", "rating": 4.7, "type": "Seafood", "img": "", "hours": "01:00 PM - 12:00 AM", "specialty": "Grilled Mediterranean Octopus", "price": "$$$", "safety": "96% (A)", "lat": 37.9818, "lng": 23.7337, "address": "Vas. Sofias 46, Athens", "phone": "+30 210 7244 400"},
    # ── Morocco ──
    {"id": 34, "name": "Le Jardin", "cuisine": "Moroccan", "country": "Morocco", "distance": "—", "rating": 4.5, "type": "Garden Dining", "img": "", "hours": "12:00 PM - 11:00 PM", "specialty": "Lamb Tagine & Couscous Royale", "price": "$$", "safety": "94% (A)", "lat": 31.6295, "lng": -7.9811, "address": "32 Souk Sidi Abdelaziz, Marrakech", "phone": "+212 5243 78295"},
    # ── Canada ──
    {"id": 35, "name": "Alo", "cuisine": "French", "country": "Canada", "distance": "—", "rating": 4.9, "type": "Fine Dining", "img": "", "hours": "05:00 PM - 11:00 PM", "specialty": "Seasonal Tasting Menu", "price": "$$$$", "safety": "99% (A+)", "lat": 43.6492, "lng": -79.3965, "address": "163 Spadina Ave, 3rd Floor, Toronto", "phone": "+1 416 260 2222"},
    # ── Argentina ──
    {"id": 36, "name": "Don Julio", "cuisine": "Argentinian", "country": "Argentina", "distance": "—", "rating": 4.8, "type": "Steakhouse", "img": "", "hours": "12:00 PM - 04:00 PM, 07:00 PM - 01:00 AM", "specialty": "Ojo de Bife & Provoleta", "price": "$$$", "safety": "96% (A)", "lat": -34.5870, "lng": -58.4290, "address": "Guatemala 4691, Palermo, Buenos Aires", "phone": "+54 11 4832 6058"},
    # ── Denmark ──
    {"id": 37, "name": "Noma", "cuisine": "Nordic", "country": "Denmark", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "05:30 PM - 12:00 AM", "specialty": "Foraging & Fermentation Menu", "price": "$$$$", "safety": "99% (A+)", "lat": 55.6839, "lng": 12.6101, "address": "Refshalevej 96, Copenhagen", "phone": "+45 32 96 32 97"},
    # ── Vietnam ──
    {"id": 38, "name": "Pho Thin", "cuisine": "Vietnamese", "country": "Vietnam", "distance": "—", "rating": 4.6, "type": "Street Food", "img": "", "hours": "06:00 AM - 08:30 PM", "specialty": "Pho Bo (Beef Pho)", "price": "$", "safety": "93% (A)", "lat": 21.0285, "lng": 105.8542, "address": "13 Lo Duc, Hai Ba Trung, Hanoi", "phone": "+84 4 3821 2709"},
    # ── Sweden ──
    {"id": 39, "name": "Frantzén", "cuisine": "Nordic", "country": "Sweden", "distance": "—", "rating": 5.0, "type": "Fine Dining", "img": "", "hours": "06:00 PM - 11:00 PM", "specialty": "Nordic-Japanese Fusion Tasting", "price": "$$$$", "safety": "99% (A+)", "lat": 59.3347, "lng": 18.0560, "address": "Klara Norra Kyrkogata 26, Stockholm", "phone": "+46 8 208 580"},
]


@app.route("/api/restaurants", methods=["GET"])
def get_restaurants():
    """Return all restaurants, optionally filtered by cuisine, country, or search query."""
    cuisine = request.args.get("cuisine", "").strip()
    country = request.args.get("country", "").strip()
    q = request.args.get("q", "").strip().lower()

    results = RESTAURANTS
    if cuisine and cuisine != "All":
        results = [r for r in results if r["cuisine"].lower() == cuisine.lower()]
    if country and country != "All":
        results = [r for r in results if r["country"].lower() == country.lower()]
    if q:
        results = [
            r for r in results
            if q in r["name"].lower() or q in r["cuisine"].lower() or q in r["type"].lower() or q in r.get("country", "").lower()
        ]
    return jsonify(results)


@app.route("/api/restaurants/countries", methods=["GET"])
def get_restaurant_countries():
    """Return list of distinct countries with restaurant count."""
    country_counts = {}
    for r in RESTAURANTS:
        c = r.get("country", "Unknown")
        country_counts[c] = country_counts.get(c, 0) + 1
    return jsonify([{"name": k, "count": v} for k, v in sorted(country_counts.items())])


@app.route("/api/restaurants/<int:restaurant_id>", methods=["GET"])
def get_restaurant(restaurant_id):
    """Return a single restaurant by ID."""
    r = next((r for r in RESTAURANTS if r["id"] == restaurant_id), None)
    if r is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(r)


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
