from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipes = db.relationship("Recipe", backref="category", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class Ingredient(db.Model):
    __tablename__ = "ingredients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    unit = db.Column(db.String(30), nullable=False, default="g")
    stock_qty = db.Column(db.Float, nullable=False, default=0.0)
    reorder_level = db.Column(db.Float, nullable=False, default=100.0)
    cost_per_unit = db.Column(db.Float, nullable=False, default=0.0)
    category = db.Column(db.String(80), default="General")

    def to_dict(self):
        status = "critical" if self.stock_qty <= self.reorder_level * 0.25 \
            else "low" if self.stock_qty <= self.reorder_level \
            else "ok"
        return {
            "id": self.id,
            "name": self.name,
            "unit": self.unit,
            "stock_qty": self.stock_qty,
            "reorder_level": self.reorder_level,
            "cost_per_unit": self.cost_per_unit,
            "category": self.category,
            "status": status,
        }


class Recipe(db.Model):
    __tablename__ = "recipes"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    prep_time = db.Column(db.Integer, default=15)   # minutes
    cook_time = db.Column(db.Integer, default=30)   # minutes
    servings = db.Column(db.Integer, default=4)
    quality_score = db.Column(db.Float, default=7.0)       # 0–10
    consistency_rating = db.Column(db.Float, default=7.0)  # 0–10
    instructions = db.Column(db.Text, default="")
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    recipe_ingredients = db.relationship("RecipeIngredient", backref="recipe", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_ingredients=False):
        d = {
            "id": self.id,
            "name": self.name,
            "category": self.category.name if self.category else "Uncategorized",
            "category_id": self.category_id,
            "prep_time": self.prep_time,
            "cook_time": self.cook_time,
            "servings": self.servings,
            "quality_score": self.quality_score,
            "consistency_rating": self.consistency_rating,
            "instructions": self.instructions,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
        }
        if include_ingredients:
            d["ingredients"] = [
                {
                    "ingredient_id": ri.ingredient_id,
                    "ingredient_name": ri.ingredient.name,
                    "unit": ri.ingredient.unit,
                    "quantity_needed": ri.quantity_needed,
                    "in_stock": ri.ingredient.stock_qty >= ri.quantity_needed,
                }
                for ri in self.recipe_ingredients
            ]
        return d


class RecipeIngredient(db.Model):
    __tablename__ = "recipe_ingredients"
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey("ingredients.id"), nullable=False)
    quantity_needed = db.Column(db.Float, nullable=False, default=1.0)
    ingredient = db.relationship("Ingredient")

    def to_dict(self):
        return {
            "id": self.id,
            "recipe_id": self.recipe_id,
            "ingredient_id": self.ingredient_id,
            "ingredient_name": self.ingredient.name,
            "unit": self.ingredient.unit,
            "quantity_needed": self.quantity_needed,
        }
